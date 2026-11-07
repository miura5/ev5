// Goals as the screens read exams (CONTRACT §data.tables): a goals row, shown as the exam document Today, Library and
// the plan already read. Every date is a goal row; there are no `exams` documents to merge.
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { parseGoal } from "../domain/index.ts";

const listPlans = (db: DocsD1, clock: () => number) =>
  tablesRepo(db, { clock }).plans.list();

export interface WireGoal {
  id: string;
  v: number;
  at: number;
  data: ReturnType<typeof parseGoal>;
}

/** The plan a goal's exam document points at, as an old exam's `planId` does: its plan in force, else the plan put away
 * last (so a put-away plan reads as put away). Approving a plan changes its plans row, never the goal row. */
function planOf(
  plans: { id: string; state: string; at: number }[],
): { id: string; at: number } | undefined {
  const inForce = plans.find((p) => p.state === "in_force");
  if (inForce) return inForce;
  let last: { id: string; at: number } | undefined;
  for (const p of plans)
    if (p.state === "put_away" && (!last || p.at >= last.at)) last = p;
  return last;
}

/** Every live goal as an exam document, in id order; one that does not fit the exam shape is left out. Its `planId`
 * comes from its plans rows (read once for every goal), and its `at` moves with them, so a goal whose plan
 * changed is sent again by `GET /docs?since`. */
export async function goalDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WireGoal[]> {
  const rows = await tablesRepo(db, { clock }).goals.list();
  const byGoal = new Map<string, Awaited<ReturnType<typeof listPlans>>>();
  for (const p of await listPlans(db, clock))
    byGoal.set(p.goal_id, [...(byGoal.get(p.goal_id) ?? []), p]);
  return rows.flatMap((g) => {
    const plans = byGoal.get(g.id) ?? [];
    const planId = planOf(plans)?.id;
    try {
      return [
        {
          id: g.id,
          v: g.v,
          at: Math.max(g.at, ...plans.map((p) => p.at)),
          data: parseGoal({
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

/** One goal as its wire document, by id; an id that is not a goal has none. */
export async function goalDoc(
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
