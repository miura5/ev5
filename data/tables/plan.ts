// The plan tables' cross-row rules on top of the generic gate (§data.gate, §data.repeat): at most one plan in force per goal
// and one plan item per repeat and day. The database's unique indexes hold the same rules, but a violated index would read as
// a lost race (409); here it is a plain refusal first (WriteRefused), so no caller mistakes it for a stale version.
import type { D1Like } from "../d1.ts";
import type { TablesOptions } from "./core.ts";
import { WriteRefused } from "./gate.ts";
import { kindsRepo } from "./kinds.ts";

export function planRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  const other = async (sql: string, ...args: (string | number)[]) =>
    (
      await db
        .prepare(sql)
        .bind(...args)
        .first<{ id: string }>()
    )?.id ?? null;
  return {
    plans: {
      ...k.plans,
      save: async (...[f, v]: Parameters<typeof k.plans.save>) => {
        if (f.state === "in_force") {
          const clash = await other(
            "SELECT id FROM plans WHERE goal_id = ? AND state = 'in_force' AND deleted_at IS NULL AND id <> ?",
            f.goal_id,
            f.id,
          );
          if (clash)
            throw new WriteRefused(
              "plans",
              `${clash} is already in force for ${f.goal_id}`,
            );
        }
        return k.plans.save(f, v);
      },
    },
    planItems: {
      ...k.planItems,
      save: async (...[f, v]: Parameters<typeof k.planItems.save>) => {
        if (f.repeat_id !== null) {
          const clash = await other(
            "SELECT id FROM plan_items WHERE repeat_id = ? AND day = ? AND id <> ?",
            f.repeat_id,
            f.day,
            f.id,
          );
          if (clash)
            throw new WriteRefused(
              "plan_items",
              `${f.repeat_id} is already placed on ${f.day} (${clash})`,
            );
        }
        return k.planItems.save(f, v);
      },
    },
  };
}
