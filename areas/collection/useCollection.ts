import { useEffect, useState } from "react";
import { mapCollection } from "./map.ts";
import type {
  CollectionData,
  DocsByCollection,
  WireCollection,
  WireDoc,
  WireMembership,
} from "./map.ts";
import { failureKind, failureSentence, readJson, readToken } from "../../commands/client.ts";

export interface CollectionState {
  data?: CollectionData;
  loaded: boolean;
  token: string;
  /** The server refused the token (401): no data and no empty state; the shell's token screen takes over. */
  refused: boolean;
  /** A plain sentence for any other failure. */
  error?: string;
}

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

/** Offline (a rejected fetch) the saved copy answers; a 401 or 5xx throws and is never kept (§data.offline). */
function get<T>(path: string, token: string, copy?: ReadCopyLike): Promise<T> {
  return readJson<T>(path, token, `collection:/api/v1/${path}`, copy);
}

/** Reads collections and memberships with the app token Matt keeps in this browser. */
export function useCollection(
  id?: string,
  copy?: ReadCopyLike,
): CollectionState {
  const token = readToken();
  const [data, setData] = useState<CollectionData>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void (async () => {
      try {
        const [c, m] = await Promise.all([
          get<{ collections: WireCollection[] }>(
            "collections",
            token,
            copy,
          ),
          get<{ memberships: WireMembership[] }>(
            "memberships",
            token,
            copy,
          ),
        ]);
        const kinds = [...new Set(m.memberships.map((x) => x.collection))];
        const docs: DocsByCollection = {};
        await Promise.all(
          kinds.map(async (k) => {
            try {
              docs[k] = (
                await get<{ docs: WireDoc[] }>(
                  `docs?collection=${k}`,
                  token,
                  copy,
                )
              ).docs;
            } catch {
              // titles fall back to ids for a kind that will not load
            }
          }),
        );
        if (live) {
          setData(mapCollection(c.collections, m.memberships, id, docs));
          setLoaded(true);
          setError(undefined);
          setRefused(false);
        }
      } catch (e) {
        if (!live) return;
        setData(undefined);
        setRefused(failureKind(e) === "refused");
        setError(failureSentence(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [token, id, copy]);
  return { data, loaded, token, refused, error };
}
