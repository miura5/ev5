// Plans as the screens read them (CONTRACT §data.tables, §data.gate): the `plans` and `plan_items` rows, served as rows (the
// `plans` and `plan_items` collections).
import { tablesRepo } from "../data/index.ts";
import type { Reads } from "./read-report.ts";
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
  reads?: Reads,
): Promise<WirePlan[]> {
  const plans = await tablesRepo(db, {
    clock,
    onBad: reads?.onBad,
  }).plans.list();
  reads?.counted("plans", plans);
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
  reads?: Reads,
): Promise<WirePlan[]> {
  const items = await tablesRepo(db, {
    clock,
    onBad: reads?.onBad,
  }).planItems.list();
  reads?.counted("plan_items", items);
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
