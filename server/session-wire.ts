// Study sessions as the screens read and write them (CONTRACT §data.tables, §data.gate, §data.append-only): the `sessions` and
// `session_events` rows, shown as the session document the page still sends and reads. A document id `ss-…` is the row id
// `ses_ss-…`. A write of the document changes the session row and appends only the events it does not yet have; an event
// already stored may not be removed or changed. Nothing is written to `docs`.
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import {
  newSessionEventRow,
  newSessionRow,
  parseSession,
  sessionDoc,
  sessionDocId,
  sessionEventId,
  sessionRowId,
} from "../domain/index.ts";

export interface WireSession {
  id: string;
  v: number;
  at: number;
  data: ReturnType<typeof sessionDoc>;
}

/** Every live session as its document, in id order. */
export async function sessionDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WireSession[]> {
  const all = await tablesRepo(db, { clock }).sessionBook.list();
  return all.map(({ row, events }) => ({
    id: sessionDocId(row.id),
    v: row.v,
    at: row.at,
    data: sessionDoc(row, events),
  }));
}

export type Saved =
  | { ok: true; at: number; version: number }
  | { ok: false; status: 400 | 409; error: string };

/**
 * Saves the session document the page sends: a create names no version, a change names the version read (a stale one is a
 * 409). The row is saved first, so the version pin guards the events too; each new event is then appended as its own row.
 */
export async function saveSession(
  db: DocsD1,
  clock: () => number,
  id: string,
  body: string,
  ifVersion: number | null,
): Promise<Saved> {
  const book = tablesRepo(db, { clock }).sessionBook;
  try {
    const doc = parseSession(JSON.parse(body));
    const cur = await book.get(sessionRowId(id));
    if ((cur?.row.v ?? null) !== ifVersion)
      return { ok: false, status: 409, error: "that changed; try again" };
    const events = Object.entries(doc.events ?? {});
    const kept = new Set(cur?.events.map((e) => e.id));
    for (const e of cur?.events ?? []) {
      const key = e.id.slice(sessionEventId(id, "").length);
      if (!doc.events?.[key])
        return {
          ok: false,
          status: 400,
          error: "session events are append-only",
        };
    }
    // Every new event is checked before anything is written.
    const fresh = events
      .filter(([key]) => !kept.has(sessionEventId(id, key)))
      .map(([key, e]) => newSessionEventRow(id, key, e));
    const next = newSessionRow(id, doc);
    const fields = cur
      ? {
          ...next,
          set_id: cur.row.set_id,
          collection_id: cur.row.collection_id,
        }
      : next;
    const saved = cur
      ? await book.change(fields, cur.row.v)
      : await book.create(fields);
    if (!saved.ok)
      return { ok: false, status: 409, error: "that changed; try again" };
    for (const e of fresh) await book.append(e);
    return { ok: true, at: saved.row.at, version: saved.row.v };
  } catch (e) {
    // A document the rules turn down (parse, size, a skill session, a bad event) is a 400.
    return { ok: false, status: 400, error: (e as Error).message };
  }
}
