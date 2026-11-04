import { useCallback, useEffect, useState } from "react";
import { parseNote, type Note } from "../../domain/index.ts";
import { mapSessions } from "./map.ts";
import type { SessionData, WireDoc } from "./map.ts";
import { api } from "../../commands/client.ts";

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
  /** The note the session reads along with, once it has loaded. */
  note?: Note;
  /** Writes the whole session document back (pinned to the version read), then reads again. False if it failed. */
  save: (doc: Record<string, unknown>) => Promise<boolean>;
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
  const [note, setNote] = useState<Note>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void (async () => {
      try {
        const r = await api("docs?collection=sessions", token);
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
  }, [token, tick]);
  const noteId = data?.noteId;
  useEffect(() => {
    setNote(undefined);
    if (!token || !noteId) return;
    let live = true;
    void (async () => {
      try {
        const r = await api(`docs?collection=notes&id=${encodeURIComponent(noteId)}`, token);
        if (!r.ok) return; // no note page: the session still runs
        const d = (await r.json()) as { data: unknown };
        if (live) setNote(parseNote(d.data));
      } catch {
        // an unreadable note leaves the page empty
      }
    })();
    return () => {
      live = false;
    };
  }, [token, noteId]);
  const save = useCallback(
    async (doc: Record<string, unknown>) => {
      if (!data) return false;
      try {
        const q = new URLSearchParams({ collection: "sessions", id: data.id });
        if (data.v !== undefined) q.set("if_version", String(data.v));
        const r = await api(`docs?${q}`, token, { method: "PUT", body: doc });
        if (!r.ok) {
          setError(
            r.status === 409
              ? "The session changed elsewhere; reloaded."
              : "That could not be saved.",
          );
          setTick((n) => n + 1);
          return false;
        }
        setTick((n) => n + 1);
        return true;
      } catch {
        setError("That could not be saved; you may be offline.");
        return false;
      }
    },
    [data, token],
  );
  return { data, token, error, setToken, note, save };
}
