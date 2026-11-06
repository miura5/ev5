// The links table's cross-row rules on top of the generic gate (§data.links, §data.gate): both ends must resolve to a
// live row on write, and the reads that say which objectives are on a goal and which goals an objective is on.
// A link to a deleted end that is later purged is the drill's orphan report, not a write rule.
import type { D1Like } from "../docs/d1.ts";
import type { TablesOptions } from "./core.ts";
import { WriteRefused } from "./gate.ts";
import { kindsRepo } from "./kinds.ts";

/** The table each link end lives in. `file` has no table yet (note pictures come later), so its end is not resolved. */
const END_TABLE: Record<string, string | undefined> = {
  goal: "goals",
  objective: "objectives",
  note: "notes",
  set: "sets",
};

export function linkRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  const live = async (table: string, id: string): Promise<boolean> =>
    (await db
      .prepare(`SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<{ id: string }>()) !== null;
  return {
    links: {
      ...k.links,
      save: async (...[f, v]: Parameters<typeof k.links.save>) => {
        for (const [kind, id] of [
          [f.from_kind, f.from_id],
          [f.to_kind, f.to_id],
        ] as const) {
          const table = END_TABLE[kind];
          if (table && !(await live(table, id)))
            throw new WriteRefused("links", `${kind} ${id} does not exist`);
        }
        return k.links.save(f, v);
      },
    },
    /** Ids of the live objectives that sit on a goal (objective -> goal links). */
    objectiveIdsOfGoal: async (goalId: string): Promise<string[]> =>
      (
        await db
          .prepare(
            "SELECT l.from_id AS id FROM links l JOIN objectives o ON o.id = l.from_id AND o.deleted_at IS NULL WHERE l.from_kind = 'objective' AND l.to_kind = 'goal' AND l.to_id = ? AND l.deleted_at IS NULL ORDER BY o.num, o.id",
          )
          .bind(goalId)
          .all<{ id: string }>()
      ).results.map((r) => r.id),
    /** Ids of the live goals an objective is on. */
    goalIdsOfObjective: async (objectiveId: string): Promise<string[]> =>
      (
        await db
          .prepare(
            "SELECT l.to_id AS id FROM links l JOIN goals g ON g.id = l.to_id AND g.deleted_at IS NULL WHERE l.from_kind = 'objective' AND l.to_kind = 'goal' AND l.from_id = ? AND l.deleted_at IS NULL ORDER BY g.date, g.id",
          )
          .bind(objectiveId)
          .all<{ id: string }>()
      ).results.map((r) => r.id),
  };
}
