import { useCallback, useEffect, useRef, useState } from "react";
import { parseNote, type Note } from "../../domain/index.ts";
import { mapSessions } from "./map.ts";
import type { SessionData, WireDoc } from "./map.ts";
import {
  api,
  failureKind,
  failureSentence,
  readJson,
  readToken,
  savedFirst,
} from "../../commands/client.ts";

export interface SessionsState {
  data?: SessionData;
  token: string;
  /** The server refused the token (401): no data and no empty state; the shell's token screen takes over. */
  refused: boolean;
  /** A plain sentence for any other failure. */
  error?: string;
  /** The note the session reads along with, once it has loaded. */
  note?: Note;
  /** Flips one todo block of the note (by its index) and writes the note back, pinned to the version read. */
  toggleTodo: (index: number) => Promise<void>;
  /** Writes the whole session document back (pinned to the version read), then reads again. False if it failed. */
  save: (doc: SessionWrite) => Promise<boolean>;
}

/** A document to write, or a builder given the latest stored one (so a write queued behind another sees its result). */
export type SessionWrite =
  | Record<string, unknown>
  | ((raw: Record<string, unknown>) => Record<string, unknown>);

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}
/** Reads sessions with the app token Matt keeps in this browser (the shell holds none). */
export function useSessions(copy?: ReadCopyLike): SessionsState {
  const token = readToken();
  const [data, setData] = useState<SessionData>();
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const [note, setNote] = useState<Note>();
  const [noteRaw, setNoteRaw] = useState<{
    raw: Record<string, unknown>;
    v?: number;
  }>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!token) return;
    let live = true;
    // Offline (a rejected fetch) the saved copy answers; a 401 or 5xx throws and is never kept (§data.offline).
    const load = (c: ReadCopyLike | undefined) =>
      readJson<WireDoc[]>(
        "docs?collection=sessions",
        token,
        "sessions:list",
        c,
        (b) => (b as { docs: WireDoc[] }).docs,
      );
    // The screen opens on the last answer kept, then the server's (§ui.instant); a re-read after a change does not.
    savedFirst(copy, tick === 0, load, (docs) => {
      if (!live) return;
      setData(mapSessions(docs, Date.now()));
      setError(undefined);
      setRefused(false);
    }).catch((e: unknown) => {
      if (!live) return;
      setData(undefined);
      setRefused(failureKind(e) === "refused");
      setError(failureSentence(e));
    });
    return () => {
      live = false;
    };
  }, [token, tick, copy]);
  const noteId = data?.noteId;
  useEffect(() => {
    setNote(undefined);
    setNoteRaw(undefined);
    if (!token || !noteId) return;
    let live = true;
    void (async () => {
      try {
        // Offline the saved note answers; a 401 or 5xx throws and leaves the page empty (§data.offline).
        const d = await readJson<{ data: unknown; v?: number }>(
          `docs?collection=notes&id=${encodeURIComponent(noteId)}`,
          token,
          `sessions:note:${noteId}`,
          copy,
        );
        if (live) {
          setNote(parseNote(d.data));
          setNoteRaw({ raw: d.data as Record<string, unknown>, v: d.v });
        }
      } catch (e) {
        // an unreadable note leaves the page empty; a refused token is told like any other
        if (live) {
          setRefused(failureKind(e) === "refused");
          setError(failureSentence(e));
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [token, noteId, copy]);
  // Writes go one at a time, each on what the one before stored: a quick Pause then End must not lose the pause.
  const latest = useRef<
    { raw: Record<string, unknown>; v?: number } | undefined
  >(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (data) latest.current = { raw: data.raw, v: data.v };
  }, [data]);
  const save = useCallback(
    (write: SessionWrite): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        const cur = latest.current;
        if (!data || !cur) return false;
        const doc = typeof write === "function" ? write(cur.raw) : write;
        try {
          const q = new URLSearchParams({
            collection: "sessions",
            id: data.id,
          });
          if (cur.v !== undefined) q.set("if_version", String(cur.v));
          const r = await api(`docs?${q}`, token, { method: "PUT", body: doc });
          if (!r.ok) {
            setRefused(r.status === 401);
            setError(
              r.status === 409
                ? "The session changed elsewhere; reloaded."
                : failureSentence(r.status),
            );
            setTick((n) => n + 1);
            return false;
          }
          latest.current = {
            raw: doc,
            v: cur.v === undefined ? undefined : cur.v + 1,
          };
          setTick((n) => n + 1);
          return true;
        } catch {
          setError("That could not be saved; you may be offline.");
          return false;
        }
      };
      const next = queue.current.then(run, run);
      queue.current = next;
      return next;
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
          setRefused(r.status === 401);
          setError(
            r.status === 409
              ? "The note changed elsewhere; reload it."
              : failureSentence(r.status),
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
  return { data, token, refused, error, note, toggleTodo, save };
}
