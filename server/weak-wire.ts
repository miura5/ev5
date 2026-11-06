// Weak spots as the screens and the plan read them (CONTRACT §data.tables, §data.gate): the `weak_spots` and
// `weak_spot_events` rows, read through the tables gate, shown as the weak spot document. A spot has no goal of its own:
// it points at an objective, and the objective is linked to goals (§data.links), so a spot's goal is the soonest upcoming
// goal its objective is linked to (a goal with no date comes after the dated ones). No name is matched.
import { tablesRepo } from "../data/index.ts";
import { goalDocs, goalsByObjective } from "./goal-wire.ts";
import type { DocsD1 } from "../data/index.ts";
import {
  newWeakSpotRow,
  parseExam,
  parseWeakSpot,
  weakSpotDoc,
} from "../domain/index.ts";

export interface WireSpot {
  id: string;
  v: number;
  at: number;
  data: ReturnType<typeof weakSpotDoc>;
  /** The date of the spot's goal, for the near-date interval. */
  goalDate: string | null;
}

/** A spot's goal: the soonest upcoming goal its objective is linked to (§data.links), else none. */
function goalOfObjective(
  rows: { id: string; data: unknown }[],
  linked: Map<string, string[]>,
) {
  const upcoming = rows.flatMap((r) => {
    try {
      const e = parseExam(r.data);
      return (e.status ?? "upcoming") === "upcoming"
        ? [{ id: r.id, goal: e }]
        : [];
    } catch {
      return []; // one malformed goal must not hide the spots
    }
  });
  return (objectiveId: string | null) =>
    upcoming
      .filter((u) => (linked.get(objectiveId ?? "") ?? []).includes(u.id))
      .sort((a, b) =>
        (a.goal.date ?? "9999").localeCompare(b.goal.date ?? "9999"),
      )[0];
}

/** Every live weak spot (a duplicate counts once, as its twin) as its document, in id order. */
export async function weakSpotDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WireSpot[]> {
  const t = tablesRepo(db, { clock });
  const [spots, events, objectives, collections, exams, linked] =
    await Promise.all([
      t.weakSpots.list(),
      t.weakSpotEvents.list(),
      t.objectives.list(),
      t.collectionRows.list(),
      goalDocs(db, clock),
      goalsByObjective(db, clock),
    ]);
  const goalOf = goalOfObjective(exams, linked);
  const objective = new Map(objectives.map((o) => [o.id, o]));
  const course = new Map(collections.map((c) => [c.id, c]));
  return spots
    .filter((s) => s.duplicate_of === null)
    .map((s) => {
      const own = events.filter((e) => e.weak_spot_id === s.id);
      const home = course.get(
        s.collection_id ??
          (s.objective_id
            ? objective.get(s.objective_id)?.collection_id
            : "") ??
          "",
      );
      const goal = goalOf(s.objective_id);
      return {
        id: s.id,
        v: s.v,
        // An event is an appended row and does not touch the spot's row, so the spot changed when its newest event came.
        at: own.reduce((m, e) => Math.max(m, e.at), s.at),
        data: weakSpotDoc(s, own, {
          exam: goal?.id ?? null,
          ...(home ? { course: home.title } : {}),
        }),
        goalDate: goal?.goal.date ?? null,
      };
    });
}

export type Created =
  | { ok: true; at: number; version: number }
  | { ok: false; status: 400 | 409; error: string };

/**
 * Creates a weak spot in its table (§data.tables, §data.gate), from the document the page or a run sends. The id is the row's
 * `ws_` id. It is a create only: a repeat id, or a named version, is a 409. A new spot carries no events and no starting counts;
 * its course comes from the document's `course` (the collection's id or title). Nothing is written to `docs`.
 */
export async function createWeakSpot(
  db: DocsD1,
  clock: () => number,
  id: string,
  body: string,
  ifVersion: number | null,
): Promise<Created> {
  if (!id.startsWith("ws_"))
    return { ok: false, status: 400, error: "a weak spot id starts with ws_" };
  if (ifVersion !== null)
    return { ok: false, status: 409, error: "a weak spot is created once" };
  const t = tablesRepo(db, { clock });
  try {
    const doc = parseWeakSpot(JSON.parse(body));
    const course = doc.course?.toLowerCase();
    const home = course
      ? (await t.collectionRows.list()).find(
          (c) =>
            c.id.toLowerCase() === course || c.title.toLowerCase() === course,
        )
      : undefined;
    const saved = await t.weakSpots.save(
      newWeakSpotRow(id, doc, home?.id ?? null),
      null,
    );
    return saved.ok
      ? { ok: true, at: saved.row.at, version: saved.row.v }
      : { ok: false, status: 409, error: "that changed; try again" };
  } catch (e) {
    return { ok: false, status: 400, error: (e as Error).message };
  }
}
