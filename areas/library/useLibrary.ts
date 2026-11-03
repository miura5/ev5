import { useCallback, useEffect, useState } from "react";
import { mapLibrary } from "./map.ts";
import type { LibraryData, WireDoc } from "./map.ts";

const KEY = "ev5.token";

const readToken = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export interface LibraryState {
  data?: LibraryData;
  token: string;
  error?: string;
  setToken: (t: string) => void;
}

class Unauthorized extends Error {}

async function list(collection: string, token: string): Promise<WireDoc[]> {
  const r = await fetch(`/api/v1/docs?collection=${collection}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (r.status === 401) throw new Unauthorized();
  if (!r.ok) throw new Error(collection);
  return ((await r.json()) as { docs: WireDoc[] }).docs;
}

/** Reads exams, weak spots and sets with the app token Matt keeps in this browser (the shell holds none). */
export function useLibrary(): LibraryState {
  const [token, setTokenState] = useState(readToken);
  const [data, setData] = useState<LibraryData>();
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
        const [exams, weakspots, sets] = await Promise.all([
          list("exams", token),
          list("weakspots", token),
          list("sets", token),
        ]);
        if (live) {
          setData(mapLibrary({ exams, weakspots, sets }, Date.now()));
          setError(undefined);
        }
      } catch (e) {
        if (live)
          setError(
            e instanceof Unauthorized
              ? "That token was not accepted."
              : "Library could not load.",
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);
  return { data, token, error, setToken };
}
