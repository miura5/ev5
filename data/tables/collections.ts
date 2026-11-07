// The collections table's cross-row rule on top of the generic gate (§data.gate, §data.membership): nesting is one level.
// A parent must exist, be live and have no parent of its own, and a collection that has children cannot take a parent.
import type { D1Like } from "../d1.ts";
import type { TablesOptions } from "./core.ts";
import { WriteRefused } from "./gate.ts";
import { kindsRepo } from "./kinds.ts";

export function collectionRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  const one = (sql: string, ...args: string[]) =>
    db
      .prepare(sql)
      .bind(...args)
      .first<{ id: string; parent_id: string | null }>();
  return {
    collectionRows: {
      ...k.collectionRows,
      save: async (...[f, v]: Parameters<typeof k.collectionRows.save>) => {
        if (f.parent_id !== null) {
          const parent = await one(
            "SELECT id, parent_id FROM collections WHERE id = ? AND deleted_at IS NULL",
            f.parent_id,
          );
          if (!parent)
            throw new WriteRefused(
              "collections",
              `parent ${f.parent_id} does not exist`,
            );
          if (parent.parent_id !== null)
            throw new WriteRefused(
              "collections",
              `${f.parent_id} is already inside ${parent.parent_id}: nesting is one level`,
            );
          const child = await one(
            "SELECT id, parent_id FROM collections WHERE parent_id = ? AND deleted_at IS NULL LIMIT 1",
            f.id,
          );
          if (child)
            throw new WriteRefused(
              "collections",
              `${f.id} holds ${child.id}: nesting is one level`,
            );
        }
        return k.collectionRows.save(f, v);
      },
    },
  };
}
