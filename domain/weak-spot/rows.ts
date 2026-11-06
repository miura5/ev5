import type { WeakSpot, WeakSpotEvent } from "./types.ts";
import type { WeakSpotEventRow, WeakSpotTableRow } from "./table.ts";

const iso = (ms: number) => new Date(ms).toISOString();

/** One appended event row as the scheduler's event: the user is the scheduler's `owner`, and the instant is the row's `at`. */
export function eventFromRow(e: WeakSpotEventRow): WeakSpotEvent {
  return {
    type: e.type,
    by: e.by === "user" ? "owner" : e.by,
    at: iso(e.at),
    ...(e.note === null ? {} : { note: e.note }),
    ...(e.objective_id === null ? {} : { objective: e.objective_id }),
    ...(e.until === null ? {} : { until: e.until }),
  };
}

/**
 * A `weak_spots` row and its `weak_spot_events` rows as the model `deriveWeakSpot` rebuilds state from. The spot points at its
 * objective (an empty one when none is set); its exam and course come from that objective, never from the spot. The
 * scheduler's rules are untouched: its starting counts are zero, as for a new spot.
 */
export function weakSpotFromRows(
  row: WeakSpotTableRow,
  events: WeakSpotEventRow[],
): WeakSpot {
  return {
    schema: 2,
    writer: row.created_by === "ev" ? "worker" : "page",
    at: iso(row.at),
    source: row.source_line,
    topic: row.topic,
    objective: row.objective_id ?? "",
    kind: row.kind,
    initial: {},
    events: Object.fromEntries(events.map((e) => [e.id, eventFromRow(e)])),
    ...(row.words === null ? {} : { words: row.words }),
    proposed: row.proposed === 1,
    preRead: row.pre_read === 1,
    readingDue: row.reading_due,
  };
}

/** An event row's key in the document shape: its type, its instant and its id's own letters, as ev4's event keys read. */
const wireKey = (e: WeakSpotEventRow) =>
  `${e.type}-${iso(e.at)
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .replace(/\.(\d{3})Z$/, "$1")}-${e.id.replace(/[^a-z0-9]/g, "")}`;

/**
 * The document the screens read (`GET /docs?collection=weakspots`) built from the rows: the model above, with the events
 * under keys the document schema accepts and the exam and course the caller worked out from the spot's objective.
 */
export function weakSpotDoc(
  row: WeakSpotTableRow,
  events: WeakSpotEventRow[],
  where: { exam: string | null; course?: string },
): WeakSpot {
  return {
    ...weakSpotFromRows(row, []),
    events: Object.fromEntries(
      events.map((e) => [wireKey(e), eventFromRow(e)]),
    ),
    exam: where.exam,
    ...(where.course ? { course: where.course } : {}),
  };
}

/** The `weak_spots` columns a new spot supplies; the gate sets `at`, `v` and `deleted_at`. */
export type NewWeakSpotRow = Omit<WeakSpotTableRow, "at" | "v" | "deleted_at">;

/**
 * A new weak spot document as its table row (§data.tables). A new spot has no events and no starting counts (the scheduler
 * starts it at zero), and it points at its objective, not at an exam. `collectionId` is the course's id, worked out by the
 * caller. Throws on a document that carries events or starting counts, which only the scheduler's rules may add.
 */
export function newWeakSpotRow(
  id: string,
  doc: WeakSpot,
  collectionId: string | null,
): NewWeakSpotRow {
  if (Object.keys(doc.events).length > 0)
    throw new Error("a new weak spot starts with no events");
  if (Object.keys(doc.initial).length > 0)
    throw new Error("a new weak spot starts with empty counts");
  return {
    id,
    collection_id: collectionId,
    objective_id: doc.objective === "" ? null : doc.objective,
    topic: doc.topic,
    kind: doc.kind,
    words: doc.words ?? null,
    source_line: doc.source,
    duplicate_of: null,
    proposed: doc.proposed ? 1 : 0,
    created_by: doc.writer === "page" ? "user" : "ev",
    pre_read: doc.preRead ? 1 : 0,
    reading_due: doc.readingDue ?? null,
  };
}
