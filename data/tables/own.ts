// Repositories for own sets, their items and their append-only attempts (CONTRACT data.append-only).
import {
  parseOwnAttempt,
  parseOwnSet,
  parseOwnSetItem,
} from "../../domain/index.ts";
import type { D1Like } from "../docs/d1.ts";
import {
  core,
  iso,
  json,
  readRows,
  type Input,
  type Raw,
  type Saved,
  type TablesOptions,
} from "./core.ts";

type OwnSet = ReturnType<typeof parseOwnSet>;
type OwnSetItem = ReturnType<typeof parseOwnSetItem>;
type OwnAttempt = ReturnType<typeof parseOwnAttempt>;

export function ownRepo(db: D1Like, opts: TablesOptions) {
  const { all, first, putVersioned } = core(db, opts);
  const toSet = (r: Raw): OwnSet =>
    parseOwnSet({
      id: r.id,
      title: r.title,
      type: r.type,
      sourceC: r.source_c,
      sourceId: r.source_id,
      at: iso(r.at as number),
      v: r.v,
    });
  const toItem = (r: Raw): OwnSetItem =>
    parseOwnSetItem({
      setId: r.set_id,
      itemId: r.item_id,
      pos: r.pos,
      body: json(r.body),
      at: iso(r.at as number),
      v: r.v,
    });

  return {
    ownSets: {
      list: async (): Promise<OwnSet[]> =>
        readRows(
          "own_sets",
          await all("SELECT * FROM own_sets ORDER BY id"),
          toSet,
          opts,
        ),
      get: async (id: string): Promise<OwnSet | null> => {
        const r = await first("SELECT * FROM own_sets WHERE id = ?", id);
        return r ? toSet(r) : null;
      },
      save: (s: Input<OwnSet>, ifVersion: number | null) =>
        putVersioned(
          "own_sets",
          ["id"],
          [s.id],
          ["title", "type", "source_c", "source_id"],
          [s.title, s.type, s.sourceC, s.sourceId],
          ifVersion,
          (v, at) =>
            toSet({
              id: s.id,
              title: s.title,
              type: s.type,
              source_c: s.sourceC,
              source_id: s.sourceId,
              at,
              v,
            }),
        ),
      items: async (setId: string): Promise<OwnSetItem[]> =>
        readRows(
          "own_set_items",
          await all(
            "SELECT * FROM own_set_items WHERE set_id = ? ORDER BY pos, item_id",
            setId,
          ),
          toItem,
          opts,
        ),
      saveItem: (i: Input<OwnSetItem>, ifVersion: number | null) =>
        putVersioned(
          "own_set_items",
          ["set_id", "item_id"],
          [i.setId, i.itemId],
          ["pos", "body"],
          [i.pos, JSON.stringify(i.body)],
          ifVersion,
          (v, at) =>
            toItem({
              set_id: i.setId,
              item_id: i.itemId,
              pos: i.pos,
              body: JSON.stringify(i.body),
              at,
              v,
            }),
        ),
    },
    ownAttempts: {
      /** Append only: a second write of the same (set, item, key, at) is refused. */
      append: async (a: Omit<OwnAttempt, "at">): Promise<Saved<OwnAttempt>> => {
        const at = opts.clock();
        const row = parseOwnAttempt({ ...a, at: iso(at) });
        try {
          await db
            .prepare(
              "INSERT INTO own_attempts (set_id, item_id, key, at, body) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(a.setId, a.itemId, a.key, at, JSON.stringify(a.body))
            .run();
        } catch {
          return { ok: false, conflict: true, current: null };
        }
        return { ok: true, row };
      },
      list: async (setId: string): Promise<OwnAttempt[]> =>
        readRows(
          "own_attempts",
          await all(
            "SELECT * FROM own_attempts WHERE set_id = ? ORDER BY at, item_id, key",
            setId,
          ),
          (r) =>
            parseOwnAttempt({
              setId: r.set_id,
              itemId: r.item_id,
              key: r.key,
              at: iso(r.at as number),
              body: json(r.body),
            }),
          opts,
        ),
    },
  };
}
