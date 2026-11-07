import { useCallback, useEffect, useRef, useState } from "react";
import {
  noteDocOf,
  parseNote,
  parseNoteTableRow,
  type Note,
  type SessionEventRow,
  type SessionTableRow,
} from "../../domain/index.ts";
import { mapSessions } from "./map.ts";
import type { SessionData } from "./map.ts";
import {
  call,
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
  /** Runs one session command on the session shown (the server appends the event), then reads again. False if it failed. */
  send: (name: SessionAct) => Promise<boolean>;
  /** Sends the typed answer to the open check (check.answer) under a fresh client-made att_ id; a refusal is told in `error`. */
  answer: (text: string) => Promise<boolean>;
}

/** The commands the screen sends for the session it shows. */
export type SessionAct = "session.pause" | "session.end" | "check.just_tell_me";

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
    // The session rows and their event rows (§data.gate), each kept under its own key.
    const load = async (c: ReadCopyLike | undefined) => {
      function rows<T>(path: string, key: string) {
        return readJson<T[]>(
          path,
          token,
          key,
          c,
          (b) => (b as { rows: T[] }).rows,
        );
      }
      const [sessions, events] = await Promise.all([
        rows<SessionTableRow>("sessions", "sessions:rows"),
        rows<SessionEventRow>("session-events", "sessions:events"),
      ]);
      return { sessions, events };
    };
    // The screen opens on the last answer kept, then the server's (§ui.instant); a re-read after a change does not.
    savedFirst(copy, tick === 0, load, ({ sessions, events }) => {
      if (!live) return;
      setData(mapSessions(sessions, events, Date.now()));
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
        // The note row (§data.tables): its document is built from the columns, its `v` pins the save.
        const d = await readJson<unknown>(
          `notes/${encodeURIComponent(noteId)}`,
          token,
          `sessions:note:${noteId}`,
          copy,
        );
        const row = parseNoteTableRow(d);
        const doc = noteDocOf(row);
        if (live) {
          setNote(doc);
          setNoteRaw({
            raw: doc as unknown as Record<string, unknown>,
            v: row.v,
          });
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
  // Commands go one at a time, so a quick Pause then End lands in order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const act = useCallback(
    (name: SessionAct | "check.answer", extra?: object): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        if (!data) return false;
        const r = await call(name, { id: data.id, ...extra }, token);
        if (!r.ok || r.mode !== "direct") {
          setRefused(r.ok ? false : r.status === 401);
          setError(
            r.ok
              ? "That could not be saved."
              : r.status === 409
                ? name === "check.answer"
                  ? "That answer was already sent."
                  : "The session changed elsewhere; reloaded."
                : r.reason,
          );
          setTick((n) => n + 1);
          return false;
        }
        setTick((n) => n + 1);
        return true;
      };
      const next = queue.current.then(run, run);
      queue.current = next;
      return next;
    },
    [data, token],
  );
  const answer = useCallback(
    (text: string) =>
      act("check.answer", {
        answer: text,
        attempt: `att_${crypto.randomUUID().replace(/-/g, "")}`,
      }),
    [act],
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
        const r = await call(
          "note.save",
          {
            id: noteId,
            body: JSON.stringify(next.blocks),
            ...(noteRaw.v !== undefined ? { if_version: noteRaw.v } : {}),
          },
          token,
        );
        if (!r.ok) {
          setRefused(r.status === 401);
          setError(
            r.status === 409
              ? "The note changed elsewhere; reload it."
              : r.reason,
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
  return { data, token, refused, error, note, toggleTodo, send: act, answer };
}
