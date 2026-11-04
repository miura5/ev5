import { useCallback, useEffect, useState } from "react";
import { mapDeletions } from "./map.ts";
import type { WireDeletion } from "./map.ts";
import type { DeletedItem } from "./Deleted.view.tsx";
import { api } from "../../commands/client.ts";

const KEY = "ev5.token";

const readToken = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export interface DeletedState {
  items: DeletedItem[];
  token: string;
  error?: string;
  setToken: (t: string) => void;
}

/** Reads soft-deleted items with the app token Matt keeps in this browser. */
export function useDeleted(): DeletedState {
  const [token, setTokenState] = useState(readToken);
  const [items, setItems] = useState<DeletedItem[]>([]);
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
        const r = await api("deletions", token);
        if (r.status === 401) throw new Error("That token was not accepted.");
        if (!r.ok) throw new Error("Recently deleted could not load.");
        const rows = ((await r.json()) as { deletions: WireDeletion[] })
          .deletions;
        if (live) {
          setItems(mapDeletions(rows, Date.now()));
          setError(undefined);
        }
      } catch (e) {
        if (live)
          setError(
            e instanceof Error ? e.message : "Recently deleted could not load.",
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);
  return { items, token, error, setToken };
}
