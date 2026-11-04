import { useCallback, useEffect, useState } from "react";
import { mapCollection } from "./map.ts";
import type { CollectionData, DocsByCollection, WireCollection, WireDoc, WireMembership } from "./map.ts";
import { api } from "../../commands/client.ts";

const KEY = "ev5.token";

const readToken = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export interface CollectionState {
  data?: CollectionData;
  loaded: boolean;
  token: string;
  error?: string;
  setToken: (t: string) => void;
}

async function get<T>(path: string, token: string): Promise<T> {
  const r = await api(path, token);
  if (r.status === 401) throw new Error("That token was not accepted.");
  if (!r.ok) throw new Error("The collection could not load.");
  return (await r.json()) as T;
}

/** Reads collections and memberships with the app token Matt keeps in this browser. */
export function useCollection(id?: string): CollectionState {
  const [token, setTokenState] = useState(readToken);
  const [data, setData] = useState<CollectionData>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const setToken = useCallback((t: string) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // storage blocked: the token lasts this visit only
    }
    setTokenState(t);
  }, []);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void (async () => {
      try {
        const [c, m] = await Promise.all([
          get<{ collections: WireCollection[] }>("/api/v1/collections", token),
          get<{ memberships: WireMembership[] }>("/api/v1/memberships", token),
        ]);
        const kinds = [...new Set(m.memberships.map((x) => x.collection))];
        const docs: DocsByCollection = {};
        await Promise.all(
          kinds.map(async (k) => {
            try {
              docs[k] = (await get<{ docs: WireDoc[] }>(`/api/v1/docs?collection=${k}`, token)).docs;
            } catch {
              // titles fall back to ids for a kind that will not load
            }
          }),
        );
        if (live) {
          setData(mapCollection(c.collections, m.memberships, id, docs));
          setLoaded(true);
          setError(undefined);
        }
      } catch (e) {
        if (live)
          setError(
            e instanceof Error ? e.message : "The collection could not load.",
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [token, id]);
  return { data, loaded, token, error, setToken };
}
