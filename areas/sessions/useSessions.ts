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
  /** Flips one todo block of the note (by its index) and writes the note back, pinned to the version read. */
  toggleTodo: (index: number) => Promise<void>;
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
  const [noteRaw, setNoteRaw] = useState<{
    raw: Record<string, unknown>;
    v?: number;
  }>();
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
    setNoteRaw(undefined);
    if (!token || !noteId) return;
    let live = true;
    void (async () => {
      try {
        const r = await api(
          `docs?collection=notes&id=${encodeURIComponent(noteId)}`,
          token,
        );
        if (!r.ok) return; // no note page: the session still runs
        const d = (await r.json()) as { data: unknown; v?: number };
        if (live) {
          setNote(parseNote(d.data));
          setNoteRaw({ raw: d.data as Record<string, unknown>, v: d.v });
        }
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
  const toggleTodo = useCallback(
    async (index: number) => {
      const blocks = noteRaw?.raw.blocks;
      if (!noteId || !noteRaw || !Array.isArray(blocks)) return;
      const b = blocks[index] as Record<string, unknown> | undefined;
      if (!b || b.type !== "todo") return;
      const next = {
        ...noteRaw.raw,
        blocks: blocks.map((x, k) =>
          k === index ? { ...b, checked: !b.checked } : x,
        ),
      };
      try {
        const q = new URLSearchParams({ collection: "notes", id: noteId });
        if (noteRaw.v !== undefined) q.set("if_version", String(noteRaw.v));
        const r = await api(`docs?${q}`, token, { method: "PUT", body: next });
        if (!r.ok) {
          setError(
            r.status === 409
              ? "The note changed elsewhere; reload it."
              : "That could not be saved.",
          );
          return;
        }
        setNote(parseNote(next));
        setNoteRaw({
          raw: next,
          v: noteRaw.v === undefined ? undefined : noteRaw.v + 1,
        });
      } catch {
        setError("That could not be saved; you may be offline.");
      }
    },
    [noteRaw, noteId, token],
  );
  return { data, token, error, setToken, note, toggleTodo, save };
}
