// Goals as the screens read exams (CONTRACT §data.tables): a goals row, shown as the exam document Today, Library and
// the plan already read. Every date is a goal row; there are no `exams` documents to merge.
import { docsRepo, tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { parseExam } from "../domain/index.ts";

export interface WireGoal {
  id: string;
  v: number;
  at: number;
  data: ReturnType<typeof parseExam>;
}

/** The plan a goal's `planedits/<goal>` document points it at, as an old exam's `planId` does: the plan in force, else
 * the plan put away last (so a put-away plan reads as put away). Approving a plan writes only `planedits`, never the row. */
function planIdOf(edit: unknown): string | undefined {
  const e = (edit ?? {}) as { plan?: unknown; retired?: unknown };
  if (typeof e.plan === "string" && e.plan) return e.plan;
  if (!e.retired || typeof e.retired !== "object") return undefined;
  const when = (r: unknown) =>
    Date.parse(String((r as { at?: unknown } | null)?.at)) || 0;
  let last: [string, number] | undefined;
  for (const [id, r] of Object.entries(e.retired))
    if (!last || when(r) >= last[1]) last = [id, when(r)];
  return last?.[0];
}

/** Every live goal as an exam document, in id order; one that does not fit the exam shape is left out. Its `planId`
 * comes from `planedits/<goal>` (read once for every goal), and its `at` moves with that document, so a goal whose plan
 * changed is sent again by `GET /docs?since`. */
export async function goalDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WireGoal[]> {
  const rows = await tablesRepo(db, { clock }).goals.list();
  const edits = new Map(
    (await docsRepo(db, { clock }).list("planedits")).map((d) => [d.id, d]),
  );
  return rows.flatMap((g) => {
    const edit = edits.get(g.id);
    const planId = planIdOf(edit?.data);
    try {
      return [
        {
          id: g.id,
          v: g.v,
          at: Math.max(g.at, edit?.at ?? 0),
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
            ...(planId ? { planId } : {}),
          }),
        },
      ];
    } catch {
      return [];
    }
  });
}

/** One goal as its exam document, by id; an id that is not a goal has none. */
export async function examDoc(
  db: DocsD1,
  clock: () => number,
  id: string,
): Promise<WireGoal | undefined> {
  if (!id.startsWith("goal_")) return undefined;
  return (await goalDocs(db, clock)).find((g) => g.id === id);
}

/** For each objective, the goals it is linked to (objective -> goal links, §data.links). */
export async function goalsByObjective(
  db: DocsD1,
  clock: () => number,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const l of await tablesRepo(db, { clock }).links.list())
    if (l.from_kind === "objective" && l.to_kind === "goal")
      out.set(l.from_id, [...(out.get(l.from_id) ?? []), l.to_id]);
  return out;
}

/** For each weak spot, the goals it is linked to directly (weak spot -> goal links, §data.links). */
export async function goalsByWeakSpot(
  db: DocsD1,
  clock: () => number,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const l of await tablesRepo(db, { clock }).links.list())
    if (l.from_kind === "weak_spot" && l.to_kind === "goal")
      out.set(l.from_id, [...(out.get(l.from_id) ?? []), l.to_id]);
  return out;
}
