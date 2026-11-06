// Repositories for collections, memberships, pins and item properties (PLAN section 5.10). Rows carry `at` (ms in D1,
// an ISO string in the domain) and `v` with the docs protocol: a new row needs ifVersion null, a change needs the version
// last read, and a stale write is refused, never merged. Every row read is parsed by its domain rule.
import { parseCollection, parseMembership } from "../../domain/index.ts";
import { parseItemProps } from "../../domain/index.ts";
import { parsePin } from "../../domain/index.ts";
import {
  core,
  iso,
  json,
  readRows,
  text,
  type Input,
  type Raw,
  type TablesOptions,
} from "./core.ts";
import type { D1Like } from "../docs/d1.ts";
import { gateRow } from "./gate.ts";
import { ownRepo } from "./own.ts";
import { draftsRepo } from "./drafts.ts";
import { jobsRepo } from "./jobs.ts";
import { jobStoresRepo } from "./job-stores.ts";
import { attemptsRepo } from "./attempts.ts";
import { collectionRepo } from "./collections.ts";
import { kindsRepo } from "./kinds.ts";
import { planRepo } from "./plan.ts";
import { setsRepo } from "./sets.ts";

type Collection = ReturnType<typeof parseCollection>;
type Membership = ReturnType<typeof parseMembership>;
type ItemProps = ReturnType<typeof parseItemProps>;
type Pin = ReturnType<typeof parsePin>;

export function tablesRepo(db: D1Like, opts: TablesOptions) {
  const { all, first, putVersioned } = core(db, opts);
  const toCollection = (r: Raw): Collection =>
    parseCollection({
      id: r.id,
      title: r.title,
      parentId: r.parent_id,
      pos: r.pos,
      at: iso(r.at as number),
      v: r.v,
    });
  const toMembership = (r: Raw): Membership =>
    parseMembership({
      itemC: r.item_c,
      itemId: r.item_id,
      collectionId: r.collection_id,
      at: iso(r.at as number),
      v: r.v,
    });
  const toProps = (r: Raw): ItemProps =>
    parseItemProps({
      c: r.c,
      id: r.id,
      time: r.time,
      repeat: json(r.repeat),
      linked: r.linked_c === null ? null : { c: r.linked_c, id: r.linked_id },
      overrides: json(r.overrides),
      at: iso(r.at as number),
      v: r.v,
    });
  return {
    collections: {
      list: async (): Promise<Collection[]> =>
        readRows(
          "collections",
          await all("SELECT * FROM collections ORDER BY pos, id"),
          toCollection,
          opts,
        ),
      get: async (id: string): Promise<Collection | null> => {
        const r = await first("SELECT * FROM collections WHERE id = ?", id);
        return r ? toCollection(r) : null;
      },
      save: (c: Input<Collection>, ifVersion: number | null) =>
        putVersioned(
          "collections",
          ["id"],
          [c.id],
          ["title", "parent_id", "pos"],
          [c.title, c.parentId, c.pos],
          ifVersion,
          (v, at) =>
            toCollection({
              id: c.id,
              title: c.title,
              parent_id: c.parentId,
              pos: c.pos,
              at,
              v,
            }),
        ),
    },
    memberships: {
      list: async (collectionId?: string): Promise<Membership[]> =>
        readRows(
          "memberships",
          collectionId === undefined
            ? await all(
                "SELECT * FROM memberships ORDER BY at DESC, item_c, item_id",
              )
            : await all(
                "SELECT * FROM memberships WHERE collection_id = ? ORDER BY at DESC, item_c, item_id",
                collectionId,
              ),
          toMembership,
          opts,
        ),
      get: async (
        itemC: string,
        itemId: string,
      ): Promise<Membership | null> => {
        const r = await first(
          "SELECT * FROM memberships WHERE item_c = ? AND item_id = ?",
          itemC,
          itemId,
        );
        return r ? toMembership(r) : null;
      },
      save: (m: Input<Membership>, ifVersion: number | null) =>
        putVersioned(
          "memberships",
          ["item_c", "item_id"],
          [m.itemC, m.itemId],
          ["collection_id"],
          [m.collectionId],
          ifVersion,
          (v, at) =>
            toMembership({
              item_c: m.itemC,
              item_id: m.itemId,
              collection_id: m.collectionId,
              at,
              v,
            }),
        ),
      /** Drops the row (moving an item into a course or out of a collection, CONTRACT data.membership). */
      remove: async (itemC: string, itemId: string): Promise<boolean> =>
        (
          await db
            .prepare("DELETE FROM memberships WHERE item_c = ? AND item_id = ?")
            .bind(itemC, itemId)
            .run()
        ).meta.changes > 0,
    },
    pins: {
      list: async (): Promise<Pin[]> =>
        readRows(
          "pins",
          await all(
            "SELECT * FROM pins WHERE deleted_at IS NULL ORDER BY pos, target_c, target_id",
          ),
          (r) =>
            parsePin({
              targetC: r.target_c,
              targetId: r.target_id,
              pos: r.pos,
              at: iso(r.at as number),
            }),
          opts,
        ),
      /** Pins have no version here: a pin is set or moved by writing its position (the latest write wins). Fills the new id and target_kind beside target_c (expand step); pinRows is the versioned form. */
      set: async (
        targetC: string,
        targetId: string,
        pos: number,
      ): Promise<Pin> => {
        const at = opts.clock();
        await db
          .prepare(
            "INSERT INTO pins (target_c, target_id, pos, at, id, target_kind) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (target_c, target_id) DO UPDATE SET pos = excluded.pos, at = excluded.at, deleted_at = NULL",
          )
          .bind(
            targetC,
            targetId,
            pos,
            at,
            `pin_${at.toString(16).padStart(11, "0")}${crypto.randomUUID().slice(0, 8)}`,
            targetC,
          )
          .run();
        return gateRow("pins", () =>
          parsePin({ targetC, targetId, pos, at: iso(at) }),
        );
      },
      remove: async (targetC: string, targetId: string): Promise<boolean> =>
        (
          await db
            .prepare("DELETE FROM pins WHERE target_c = ? AND target_id = ?")
            .bind(targetC, targetId)
            .run()
        ).meta.changes > 0,
    },
    itemProps: {
      get: async (c: string, id: string): Promise<ItemProps | null> => {
        const r = await first(
          "SELECT * FROM item_props WHERE c = ? AND id = ?",
          c,
          id,
        );
        return r ? toProps(r) : null;
      },
      list: async (): Promise<ItemProps[]> =>
        readRows(
          "item_props",
          await all("SELECT * FROM item_props ORDER BY c, id"),
          toProps,
          opts,
        ),
      save: (p: Input<ItemProps>, ifVersion: number | null) =>
        putVersioned(
          "item_props",
          ["c", "id"],
          [p.c, p.id],
          ["time", "repeat", "linked_c", "linked_id", "overrides"],
          [
            p.time,
            text(p.repeat),
            p.linked?.c ?? null,
            p.linked?.id ?? null,
            text(p.overrides),
          ],
          ifVersion,
          (v, at) =>
            toProps({
              c: p.c,
              id: p.id,
              time: p.time,
              repeat: text(p.repeat),
              linked_c: p.linked?.c ?? null,
              linked_id: p.linked?.id ?? null,
              overrides: text(p.overrides),
              at,
              v,
            }),
        ),
    },
    ...ownRepo(db, opts),
    ...draftsRepo(db, opts),
    ...jobsRepo(db, opts),
    ...jobStoresRepo(db, opts),
    ...kindsRepo(db, opts),
    ...collectionRepo(db, opts),
    ...planRepo(db, opts),
    ...attemptsRepo(db, opts),
    ...setsRepo(db, opts),
  };
}
/** @public Used by the first consumer, a later task. */
export type TablesRepo = ReturnType<typeof tablesRepo>;
