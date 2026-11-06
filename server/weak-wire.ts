// Weak spots as the screens and the plan read them (CONTRACT §data.tables, §data.gate): the `weak_spots` and
// `weak_spot_events` rows, read through the tables gate, shown as the weak spot document. A spot has no exam of its own: it
// points at an objective, the objective sits in a course (a collection), and an exam belongs to the course it names, so a
// spot's exam is the nearest upcoming dated exam of its course (an exam of that course with no date comes after the dated ones).
import { tablesRepo } from "../data/index.ts";
import { examDocs, goalsByObjective } from "./goal-wire.ts";
import type { DocsD1 } from "../data/index.ts";
import {
  newWeakSpotRow,
  parseExam,
  parseWeakSpot,
  weakSpotDoc,
} from "../domain/index.ts";
import type { Exam } from "../domain/index.ts";

export interface WireSpot {
  id: string;
  v: number;
  at: number;
  data: ReturnType<typeof weakSpotDoc>;
  /** The date of the spot's exam, for the near-exam interval. */
  examDate: string | null;
}

/** The exams of each course, soonest first: an exam names its course by the collection's id or its title. */
function examsByCourse(
  rows: { id: string; data: unknown }[],
  linked: Map<string, string[]>,
) {
  const exams = rows.flatMap((r) => {
    try {
      const e = parseExam(r.data);
      return (e.status ?? "upcoming") === "upcoming" && e.course
        ? [{ id: r.id, exam: e }]
        : [];
    } catch {
      return []; // one malformed exam must not hide the spots
    }
  });
  const soonest = (a: { exam: Exam }, b: { exam: Exam }) =>
    (a.exam.date ?? "9999").localeCompare(b.exam.date ?? "9999");
  const upcoming = rows.flatMap((r) => {
    try {
      const e = parseExam(r.data);
      return (e.status ?? "upcoming") === "upcoming"
        ? [{ id: r.id, exam: e }]
        : [];
    } catch {
      return [];
    }
  });
  return (
    course: { id: string; title: string } | undefined,
    objectiveId?: string | null,
  ) =>
    // A goal the spot's objective is linked to (§data.links) wins over the course match.
    upcoming
      .filter((u) => (linked.get(objectiveId ?? "") ?? []).includes(u.id))
      .sort(soonest)[0] ??
    (course
      ? exams
          .filter(
            ({ exam }) =>
              exam.course?.toLowerCase() === course.id.toLowerCase() ||
              exam.course?.toLowerCase() === course.title.toLowerCase(),
          )
          .sort(soonest)[0]
      : undefined);
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
      examDocs(db, clock),
      goalsByObjective(db, clock),
    ]);
  const examOf = examsByCourse(exams, linked);
  const objective = new Map(objectives.map((o) => [o.id, o]));
  const course = new Map(collections.map((c) => [c.id, c]));
  return spots
    .filter((s) => s.duplicate_of === null)
    .map((s) => {
      const home = course.get(
        s.collection_id ??
          (s.objective_id
            ? objective.get(s.objective_id)?.collection_id
            : "") ??
          "",
      );
      const exam = examOf(home, s.objective_id);
      return {
        id: s.id,
        v: s.v,
        at: s.at,
        data: weakSpotDoc(
          s,
          events.filter((e) => e.weak_spot_id === s.id),
          {
            exam: exam?.id ?? null,
            ...(home ? { course: home.title } : {}),
          },
        ),
        examDate: (exam?.exam as Exam | undefined)?.date ?? null,
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
