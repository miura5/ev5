import { useCallback, useEffect, useState } from "react";
import { mapSessions } from "./map.ts";
import type { SessionData, WireDoc } from "./map.ts";

const KEY = "ev5.token";

const readToken = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export interface SessionsState {
  data?: SessionData;
  token: string;
  error?: string;
  setToken: (t: string) => void;
}

/** Reads study sessions with the app token Matt keeps in this browser (the shell holds none). */
export function useSessions(): SessionsState {
  const [token, setTokenState] = useState(readToken);
  const [data, setData] = useState<SessionData>();
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
        const r = await fetch("/api/v1/docs?collection=sessions", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (r.status === 401) throw new Error("That token was not accepted.");
        if (!r.ok) throw new Error("Sessions could not load.");
        const docs = ((await r.json()) as { docs: WireDoc[] }).docs;
        if (live) {
          setData(mapSessions(docs, Date.now()));
          setError(undefined);
        }
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "Sessions could not load.");
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);
  return { data, token, error, setToken };
}
