// Plans as the screens read them (CONTRACT §data.tables, §data.gate): the `plans` and `plan_items` rows, served as rows (the
// `plans` and `plan_items` collections). `planeditDocs` is only the goal wire's way to find a goal's plan (server/goal-wire.ts).
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";

export interface WirePlan {
  id: string;
  v: number;
  at: number;
  data: unknown;
}

/** Every live plan as its row (goal, state, title), in id order: Today and Library read rows, not a plan document. */
export async function planRowDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WirePlan[]> {
  const plans = await tablesRepo(db, { clock }).plans.list();
  return plans
    .map((p) => ({
      id: p.id,
      v: p.v,
      at: p.at,
      data: { goal_id: p.goal_id, state: p.state, title: p.title ?? "" },
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Every live plan item as its row (plan, day, title, minutes, linked weak spot), by day then position. */
export async function planItemDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WirePlan[]> {
  const items = await tablesRepo(db, { clock }).planItems.list();
  return [...items]
    .sort((a, b) => a.day.localeCompare(b.day) || a.pos - b.pos)
    .map((i) => ({
      id: i.id,
      v: i.v,
      at: i.at,
      data: {
        plan_id: i.plan_id,
        day: i.day,
        title: i.title,
        minutes: i.minutes,
        pos: i.pos,
        ...(i.linked_kind === "weak_spot" && i.linked_id
          ? { weak_spot_id: i.linked_id }
          : {}),
      },
    }));
}

/** Which plan is in force per goal, as `planedits/<goal>`: `plan` for the plan in force, `retired` for those put away. */
export async function planeditDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WirePlan[]> {
  const plans = await tablesRepo(db, { clock }).plans.list();
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
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}
