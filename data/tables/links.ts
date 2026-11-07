// The links table's cross-row rules on top of the generic gate (§data.links, §data.gate): both ends must resolve to a
// live row on write, and the reads that say which objectives are on a goal and which goals an objective is on.
// A link to a deleted end that is later purged is the drill's orphan report, not a write rule.
import { parseGoalRow, parseLinkRow } from "../../domain/index.ts";
import type { D1Like } from "../d1.ts";
import { insertConflict, type TablesOptions } from "./core.ts";
import { gateRow, WriteRefused } from "./gate.ts";
import type { Fields } from "./kinds.ts";
import { kindsRepo } from "./kinds.ts";

/** The table each link end lives in. `file` has no table yet (note pictures come later), so its end is not resolved. */
const END_TABLE: Record<string, string | undefined> = {
  goal: "goals",
  weak_spot: "weak_spots",
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
    /**
     * Makes a goal and its objective links in ONE batch (§data.gate): every row is parsed and every objective end
     * checked live before anything is written (a missing one is a WriteRefused and no goal row exists), and a taken id
     * rolls the whole batch back and answers a conflict.
     */
    createGoalWithLinks: async (
      goal: Fields<ReturnType<typeof parseGoalRow>>,
      links: Fields<ReturnType<typeof parseLinkRow>>[],
    ) => {
      const at = opts.clock();
      const stamp = <T extends object>(f: T) => ({
        ...f,
        at,
        v: 1,
        deleted_at: null,
      });
      const goalRow = gateRow("goals", () => parseGoalRow(stamp(goal)));
      const linkRows = links.map((l) =>
        gateRow("links", () => parseLinkRow(stamp(l))),
      );
      for (const l of linkRows)
        if (
          l.from_kind === "objective" &&
          !(await live("objectives", l.from_id))
        )
          throw new WriteRefused(
            "links",
            `objective ${l.from_id} does not exist`,
          );
      const insert = (table: string, row: Record<string, unknown>) => {
        const names = Object.keys(row);
        return db
          .prepare(
            `INSERT INTO ${table} (${names.map((n) => `"${n}"`).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
          )
          .bind(...names.map((n) => row[n] as string | number | null));
      };
      try {
        await db.batch([
          insert("goals", goalRow),
          ...linkRows.map((l) => insert("links", l)),
        ]);
      } catch (e) {
        insertConflict("goals", e);
        return { ok: false as const, conflict: true as const };
      }
      return { ok: true as const, goal: goalRow, links: linkRows };
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
