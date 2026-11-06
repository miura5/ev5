import { entryTime, toMs } from "./stamp.ts";
import type { SessionEventRow, SessionTableRow } from "./table.ts";
import type { Session, SessionEvent } from "./types.ts";

// A session as rows (§data.tables, §data.append-only). The row's id is the document id with `ses_` in front; an event's id is
// `sese_<document id>:<event key>`, so the key the page wrote reads back unchanged and a repeated key is the same event.
const iso = (ms: number) => new Date(ms).toISOString();

export const sessionRowId = (docId: string) => `ses_${docId}`;
export const sessionDocId = (rowId: string) => rowId.slice(4);
export const sessionEventId = (docId: string, key: string) =>
  `sese_${docId}:${key}`;
const keyOfEvent = (docId: string, id: string) =>
  id.slice(`sese_${docId}:`.length);

/** The `sessions` columns a caller supplies; the gate sets `at`, `v` and `deleted_at`. */
export type NewSessionRow = Omit<SessionTableRow, "at" | "v" | "deleted_at">;
export type NewSessionEventRow = Omit<SessionEventRow, "v">;

const msOrNull = (s: string | null | undefined) => {
  const n = toMs(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * A session document as its `sessions` row (every session is a note session). The document's other
 * fields (source, comments, folder, filing) are not columns: the clock is rebuilt from the events, never kept.
 */
export function newSessionRow(docId: string, doc: Session): NewSessionRow {
  const driverAt = doc.driver ? msOrNull(doc.driver.at) : null;
  return {
    id: sessionRowId(docId),
    kind: "note",
    note_id: doc.noteId || null,
    set_id: null,
    collection_id: null,
    day: doc.date,
    status: doc.status ?? (doc.endedAt ? "ended" : "active"),
    planned_min: doc.planned ?? null,
    started_at: msOrNull(doc.startedAt),
    ended_at: msOrNull(doc.endedAt),
    topic: doc.topic ?? null,
    clock: doc.clock ?? null,
    minutes: doc.minutes == null ? null : Math.max(0, Math.round(doc.minutes)),
    driver:
      doc.driver && driverAt !== null
        ? { view: doc.driver.view, at: driverAt }
        : null,
  };
}

/** One event of a document's `events` map as a `session_events` row; its instant is its own `at`, else the one in its key. */
export function newSessionEventRow(
  docId: string,
  key: string,
  e: SessionEvent,
): NewSessionEventRow {
  const at = toMs(entryTime(key, e));
  if (!Number.isFinite(at))
    throw new Error(`event ${key} has no readable time`);
  const { type, at: _at, ...rest } = e;
  return {
    id: sessionEventId(docId, key),
    session_id: sessionRowId(docId),
    type,
    body: Object.keys(rest).length
      ? (rest as NonNullable<SessionEventRow["body"]>)
      : null,
    at,
  };
}

/** The document the screens and the clock read (`GET /docs?collection=sessions`), built from the rows. */
export function sessionDoc(
  row: SessionTableRow,
  events: SessionEventRow[],
): Session {
  const docId = sessionDocId(row.id);
  return {
    schema: 2,
    writer: "page",
    at: iso(row.at),
    source: "E.V. Home",
    date: row.day,
    status: row.status,
    kind: row.kind,
    comments: "some",
    startedAt: row.started_at === null ? null : iso(row.started_at),
    endedAt: row.ended_at === null ? null : iso(row.ended_at),
    ...(row.topic === null ? {} : { topic: row.topic }),
    noteId: row.note_id ?? "",
    ...(row.note_id && /^n-[A-Za-z0-9-]{1,120}$/.test(row.note_id)
      ? { note: `notes/${row.note_id}` }
      : {}),
    ...(row.planned_min === null ? {} : { planned: row.planned_min }),
    ...(row.clock === null ? {} : { clock: row.clock }),
    ...(row.minutes === null ? {} : { minutes: row.minutes }),
    ...(row.driver === null
      ? {}
      : { driver: { view: row.driver.view, at: iso(row.driver.at) } }),
    events: Object.fromEntries(
      events.map((e) => [
        keyOfEvent(docId, e.id),
        {
          ...(e.body as object | null),
          type: e.type,
          at: iso(e.at),
        } as SessionEvent,
      ]),
    ),
  };
}
