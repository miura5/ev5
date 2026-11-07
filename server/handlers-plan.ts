// The plan-item commands (CONTRACT §cmd.registry, §data.gate): a plan item is a `plan_items` row made by the user (origin
// user), its time, link and repeat are columns of that row, and a tick is its `done_at`. Every write goes through the
// gate with the row's version, so a stale write is a 409. A repeat is a `repeats` row, and its next days' occurrences are
// rows of their own (PLAN §5.10); a collection is a membership row for a live `col_` id, and "none" takes the item out.
import { addDays, centralDate } from "../domain/index.ts";
import { batchWrites } from "../data/index.ts";
import { CommandError, flushWrites, type CommandHandler } from "./handlers-core.ts";
import {
  checkDate,
  fieldsOf,
  findItem,
  nextPos,
  saveItem,
} from "./plan-days.ts";
import {
  materializeRepeat,
  optionsOf,
  placeItem,
  saveRepeat,
} from "./plan-options.ts";
import type { Fields } from "./plan-options.ts";

export const planHandlers: Record<string, CommandHandler> = {
  "plan.create": async (i: Fields & { title: string }, _c, x) => {
    const date = checkDate(i.date ?? centralDate(x.clock()));
    const o = await optionsOf(x, i, date);
    const base = {
      id: `pli_${x.newId()}`,
      plan_id: null,
      day: date,
      pos: await nextPos(x, date),
      title: i.title,
      minutes: i.estimateMinutes ?? null,
      time: o.time ?? null,
      origin: "user" as const,
      linked_kind: o.linked?.kind ?? null,
      linked_id: o.linked?.id ?? null,
      repeat_id: null,
      done_at: null,
    };
    const repeat_id = o.repeat
      ? await saveRepeat(x, base, o.repeat, null, x.newId())
      : null;
    const row = await saveItem(x, { ...base, repeat_id }, null);
    await materializeRepeat(x, row);
    if (o.collection !== undefined) await placeItem(x, row.id, o.collection);
    return { id: row.id, date };
  },

  "plan.update": async (i: Fields & { id: string }, _c, ctx) => {
    const cur = await findItem(ctx, i.id);
    const to = i.date === undefined ? cur.day : checkDate(i.date);
    const o = await optionsOf(ctx, i, to);
    // The repeat, the item, its topped-up days and the collection are ONE batch: all land or none does (§data.gate).
    const w = batchWrites(ctx.db);
    const x = { ...ctx, db: w.db };
    const next = {
      ...fieldsOf(cur),
      day: to,
      pos: to === cur.day ? cur.pos : await nextPos(x, to),
      title: i.title ?? cur.title,
      minutes: i.estimateMinutes ?? cur.minutes,
      time: o.time === undefined ? cur.time : o.time,
      linked_kind:
        o.linked === undefined ? cur.linked_kind : (o.linked?.kind ?? null),
      linked_id:
        o.linked === undefined ? cur.linked_id : (o.linked?.id ?? null),
    };
    next.repeat_id =
      o.repeat === undefined
        ? cur.repeat_id
        : o.repeat === null
          ? null
          : await saveRepeat(x, next, o.repeat, cur.repeat_id, x.newId());
    const row = await saveItem(x, next, cur.v);
    // A repeat is topped up on every change, so a date change reaches the days not yet written.
    await materializeRepeat(x, row, o.repeat ?? undefined);
    if (o.collection !== undefined) await placeItem(x, row.id, o.collection);
    await flushWrites(w, "that item or its repeat changed; try again");
    return { id: row.id, date: to };
  },

  "plan.move_tomorrow": async (i: { id: string }, c, x) => {
    const from = await findItem(x, i.id);
    return planHandlers["plan.update"]?.(
      { id: i.id, date: addDays(from.day, 1) } as never,
      c,
      x,
    );
  },

  // `done` sets the tick (idempotent) and `if_version` makes a stale screen a 409; both are optional while old callers
  // (flip with no version) remain (PLAN §11 expand).
  "plan.toggle_done": async (
    i: { id: string; done?: boolean; if_version?: number },
    _c,
    x,
  ) => {
    const cur = await findItem(x, i.id);
    if (i.if_version !== undefined && i.if_version !== cur.v)
      throw new CommandError(409, "that item changed; try again");
    const done = i.done ?? cur.done_at === null;
    if (i.done !== undefined && done === (cur.done_at !== null))
      return { id: i.id, done };
    await saveItem(
      x,
      { ...fieldsOf(cur), done_at: done ? x.clock() : null },
      cur.v,
    );
    return { id: i.id, done };
  },

  // Carried out by the screen (it opens the session); the server only agrees.
  "plan.start": async () => ({ client: true }),
  "plan.start_next": async () => ({ client: true }),
};
