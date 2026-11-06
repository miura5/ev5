// Goals as the screens read exams (CONTRACT §data.tables): a goals row, shown as the exam document Today, Library and
// the plan already read. Until the backfill moves the old `exams` documents into goals, the exams list is both.
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { parseExam } from "../domain/index.ts";

export interface WireGoal {
  id: string;
  v: number;
  at: number;
  data: ReturnType<typeof parseExam>;
}

/** Every live goal as an exam document, in id order; one that does not fit the exam shape is left out. */
export async function goalDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WireGoal[]> {
  const rows = await tablesRepo(db, { clock }).goals.list();
  return rows.flatMap((g) => {
    try {
      return [
        {
          id: g.id,
          v: g.v,
          at: g.at,
          data: parseExam({
            schema: 2,
            writer: g.created_by === "user" ? "page" : "worker",
            at: new Date(g.at).toISOString(),
            source: "v5/goals",
            title: g.title,
            kind: g.kind,
            ...(g.collection_id ? { course: g.collection_id } : {}),
            date: g.date,
            status: g.status === "done" ? "done" : "upcoming",
          }),
        },
      ];
    } catch {
      return [];
    }
  });
}
