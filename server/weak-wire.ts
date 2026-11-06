// Weak spots as the screens and the plan read them (CONTRACT §data.tables, §data.gate): the `weak_spots` and
// `weak_spot_events` rows, read through the tables gate, shown as the weak spot document. A spot has no exam of its own: it
// points at an objective, the objective sits in a course (a collection), and an exam belongs to the course it names, so a
// spot's exam is the nearest upcoming dated exam of its course (an exam of that course with no date comes after the dated ones).
import { docsRepo, tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { parseExam, weakSpotDoc } from "../domain/index.ts";
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
function examsByCourse(rows: { id: string; data: unknown }[]) {
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
  return (course: { id: string; title: string } | undefined) =>
    course
      ? exams
          .filter(
            ({ exam }) =>
              exam.course?.toLowerCase() === course.id.toLowerCase() ||
              exam.course?.toLowerCase() === course.title.toLowerCase(),
          )
          .sort((a, b) =>
            (a.exam.date ?? "9999").localeCompare(b.exam.date ?? "9999"),
          )[0]
      : undefined;
}

/** Every live weak spot (a duplicate counts once, as its twin) as its document, in id order. */
export async function weakSpotDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WireSpot[]> {
  const t = tablesRepo(db, { clock });
  const [spots, events, objectives, collections, exams] = await Promise.all([
    t.weakSpots.list(),
    t.weakSpotEvents.list(),
    t.objectives.list(),
    t.collections.list(),
    docsRepo(db, { clock }).list("exams"),
  ]);
  const examOf = examsByCourse(exams);
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
      const exam = examOf(home);
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
