// The one writer of sets and their items on the tables gate (§data.tables, §data.gate, §data.item-versions): own sets and
// E.V.'s share `sets` and `set_items`. Every change to an item first files the version it replaces in `set_item_versions`
// (id `<item_id>@<item_v>`), then bumps the item's `v`, so an attempt's item_v always names a body that can be read back.
import type { SetItemRow, SetTableRow } from "../../domain/index.ts";
import type { D1Like } from "../docs/d1.ts";
import type { Saved, TablesOptions } from "./core.ts";
import { WriteRefused } from "./gate.ts";
import { kindsRepo, type Fields } from "./kinds.ts";

/** What an edit may change; the id and the set an item belongs to are not editable. */
export type ItemEdit = Partial<Omit<Fields<SetItemRow>, "id" | "set_id">>;

export function setsRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  return {
    setBook: {
      /** Creates a set (a new id); a repeated id is a conflict. */
      create: (s: Fields<SetTableRow>) => k.sets.save(s, null),
      /** Changes a set at the version read (title, source, collection). */
      update: (s: Fields<SetTableRow>, ifVersion: number) =>
        k.sets.save(s, ifVersion),
      /** Adds an item to a live set (a new id); a repeated id is a conflict. */
      addItem: async (i: Fields<SetItemRow>): Promise<Saved<SetItemRow>> => {
        if (!(await k.sets.get(i.set_id)))
          throw new WriteRefused("set_items", `${i.set_id} is not a set`);
        return k.setItems.save(i, null);
      },
      /** Edits an item at the version read: files the replaced version, then saves the change as version + 1. */
      editItem: async (
        id: string,
        edit: ItemEdit,
        ifVersion: number,
      ): Promise<Saved<SetItemRow>> => {
        const cur = await k.setItems.get(id);
        if (!cur || cur.v !== ifVersion)
          return { ok: false, conflict: true, current: cur?.v ?? null };
        // A version already filed is a retry of this very edit: the saved item still decides who wins.
        await k.setItemVersions.add({
          id: `${id}@${cur.v}`,
          item_id: id,
          item_v: cur.v,
          body: cur.body,
        });
        const { at: _at, v: _v, deleted_at: _d, ...fields } = cur;
        return k.setItems.save({ ...fields, ...edit }, ifVersion);
      },
      /** Removes an item from its set (soft); its versions and its attempts stay. */
      removeItem: (id: string, ifVersion: number) =>
        k.setItems.remove(id, ifVersion),
      /** Brings a removed item back. */
      restoreItem: (id: string, ifVersion: number) =>
        k.setItems.restore(id, ifVersion),
      /** The version of an item an attempt names, or null. */
      itemVersion: async (id: string, v: number) =>
        (await k.setItemVersions.get(`${id}@${v}`)) ??
        ((await k.setItems.get(id))?.v === v ? await k.setItems.get(id) : null),
      /**
       * The live sets with a live item whose stem matches any of the `LIKE` patterns (domain/search `likePatterns`), each
       * with the stems of all its live items in order (§data.search).
       */
      search: async (
        patterns: readonly string[],
      ): Promise<{ id: string; title: string | null; stems: string[] }[]> => {
        if (!patterns.length) return [];
        const stem = "json_extract(body, '$.stem')";
        const where = patterns.map(() => `${stem} LIKE ?`).join(" OR ");
        const { results } = await db
          .prepare(
            `SELECT s.id AS id, s.title AS title, json_extract(i.body, '$.stem') AS stem FROM sets s JOIN set_items i ON i.set_id = s.id ` +
              `WHERE s.deleted_at IS NULL AND i.deleted_at IS NULL AND s.id IN ` +
              `(SELECT set_id FROM set_items WHERE deleted_at IS NULL AND (${where})) ORDER BY s.id, i.pos, i.id`,
          )
          .bind(...patterns)
          .all<{ id: string; title: string | null; stem: string | null }>();
        const by = new Map<
          string,
          { id: string; title: string | null; stems: string[] }
        >();
        for (const r of results) {
          const s = by.get(r.id) ?? { id: r.id, title: r.title, stems: [] };
          if (r.stem) s.stems.push(r.stem);
          by.set(r.id, s);
        }
        return [...by.values()];
      },
      /** A set with its live items in order, or null when the set is missing or deleted. */
      read: async (id: string) => {
        const set = await k.sets.get(id);
        if (!set) return null;
        const items = await k.setItems.list({ where: { set_id: id } });
        return { set, items };
      },
    },
  };
}
