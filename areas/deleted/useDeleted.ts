import { useEffect, useState } from "react";
import { mapDeletions } from "./map.ts";
import type { WireDeletion } from "./map.ts";
import type { DeletedItem } from "./Deleted.view.tsx";
import {
  failureKind,
  failureSentence,
  readJson,
  readToken,
} from "../../commands/client.ts";

export interface DeletedState {
  items: DeletedItem[];
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

/** Reads soft-deleted items with the app token Matt keeps in this browser. */
export function useDeleted(copy?: ReadCopyLike): DeletedState {
  const token = readToken();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void (async () => {
      try {
        // Offline (a rejected fetch) the saved copy answers; a 401 or 5xx throws and is never kept (§data.offline).
        const rows = await readJson<WireDeletion[]>(
          "deletions",
          token,
          "deleted:list",
          copy,
          (b) => (b as { deletions: WireDeletion[] }).deletions,
        );
        if (live) {
          setItems(mapDeletions(rows, Date.now()));
          setError(undefined);
          setRefused(false);
        }
      } catch (e) {
        if (!live) return;
        setItems([]);
        setRefused(failureKind(e) === "refused");
        setError(failureSentence(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [token, copy]);
  return { items, token, refused, error };
}
