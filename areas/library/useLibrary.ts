import { useCallback, useEffect, useState } from "react";
import { mapLibrary } from "./map.ts";
import type { LibraryData, WireDoc } from "./map.ts";
import { api } from "../../commands/client.ts";

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

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

class Unauthorized extends Error {}

/** Offline (a rejected fetch) the saved copy answers; a 401 or 5xx throws and is never kept as the copy (§data.offline). */
function list(
  collection: string,
  token: string,
  copy?: ReadCopyLike,
): Promise<WireDoc[]> {
  const fetcher = async (): Promise<WireDoc[]> => {
    const r = await api(`docs?collection=${collection}`, token);
    if (r.status === 401) throw new Unauthorized();
    if (!r.ok) throw new Error(collection);
    return ((await r.json()) as { docs: WireDoc[] }).docs;
  };
  return copy ? copy.read(`library:${collection}`, fetcher) : fetcher();
}

/** Reads exams, weak spots and sets with the app token Matt keeps in this browser (the shell holds none). */
export function useLibrary(copy?: ReadCopyLike): LibraryState {
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
          list("exams", token, copy),
          list("weakspots", token, copy),
          list("sets", token, copy),
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
  }, [token, copy]);
  return { data, token, error, setToken };
}
