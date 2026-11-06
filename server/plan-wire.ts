// Plans as the screens read them (CONTRACT §data.tables, §data.gate): the `plans` and `plan_items` rows, shown as the older
// `plans` document (days of tasks) and the `planedits/<goal>` document (which plan is in force, which are put away) that Today and
// Library already read. A goal with a plan row is read from rows alone; a goal without one still reads its older documents.
import { docsRepo, tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";

export interface WirePlan {
  id: string;
  v: number;
  at: number;
  data: unknown;
}

/** A plan item's id as the day's ticks key it: the row id without its `pli_` prefix (the id the older document gave). */
const taskId = (id: string) => id.replace(/^pli_/, "");

/** Every live plan as its document, then the older `plans` documents the rows do not replace, in id order. */
export async function planDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WirePlan[]> {
  const t = tablesRepo(db, { clock });
  const [plans, items, old] = await Promise.all([
    t.plans.list(),
    t.planItems.list(),
    docsRepo(db, { clock }).list("plans"),
  ]);
  const goals = new Set(plans.map((p) => p.goal_id));
  const rows = plans.map((p) => {
    const mine = items
      .filter((i) => i.plan_id === p.id)
      .sort((a, b) => a.day.localeCompare(b.day) || a.pos - b.pos);
    const days = [...new Set(mine.map((i) => i.day))].map((date) => ({
      date,
      tasks: mine
        .filter((i) => i.day === date)
        .map((i) => ({
          id: taskId(i.id),
          text: i.title,
          kind: "study",
          ...(i.minutes === null ? {} : { minutes: i.minutes }),
          ...(i.linked_kind === "weak_spot" && i.linked_id
            ? { ref: i.linked_id }
            : {}),
        })),
    }));
    return {
      id: p.id,
      v: p.v,
      at: Math.max(p.at, ...mine.map((i) => i.at)),
      data: {
        schema: 1,
        exam: p.goal_id,
        title: p.title ?? "",
        state: p.state,
        days,
      },
    };
  });
  const have = new Set(rows.map((r) => r.id));
  const legacy = old
    .filter((d) => !have.has(d.id))
    .filter((d) => !goals.has(String((d.data as { exam?: unknown }).exam)))
    .map((d) => ({ id: d.id, v: d.v, at: d.at, data: d.data }));
  return [...rows, ...legacy].sort((a, b) => a.id.localeCompare(b.id));
}

/** Which plan is in force per goal, as `planedits/<goal>`: `plan` for the plan in force, `retired` for those put away. */
export async function planeditDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WirePlan[]> {
  const [plans, old] = await Promise.all([
    tablesRepo(db, { clock }).plans.list(),
    docsRepo(db, { clock }).list("planedits"),
  ]);
  const byGoal = new Map<string, typeof plans>();
  for (const p of plans)
    byGoal.set(p.goal_id, [...(byGoal.get(p.goal_id) ?? []), p]);
  const rows = [...byGoal].map(([goal, ps]) => {
    const inForce = ps.find((p) => p.state === "in_force");
    const retired = Object.fromEntries(
      ps
        .filter((p) => p.state === "put_away")
        .map((p) => [p.id, { at: new Date(p.at).toISOString(), by: "Matt" }]),
    );
    return {
      id: goal,
      v: Math.max(...ps.map((p) => p.v)),
      at: Math.max(...ps.map((p) => p.at)),
      data: {
        schema: 2,
        ...(inForce ? { plan: inForce.id } : {}),
        ...(Object.keys(retired).length ? { retired } : {}),
      },
    };
  });
  const have = new Set(rows.map((r) => r.id));
  return [
    ...rows,
    ...old
      .filter((d) => !have.has(d.id))
      .map((d) => ({ id: d.id, v: d.v, at: d.at, data: d.data })),
  ].sort((a, b) => a.id.localeCompare(b.id));
}
