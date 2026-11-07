// The plan-item commands (CONTRACT §cmd.registry, §data.gate): a plan item is a `plan_items` row made by the user (origin
// user), its time, link and repeat are columns of that row, and a tick is its `done_at`. Every write goes through the
// gate with the row's version, so a stale write is a 409. A repeat is a `repeats` row, and its next days' occurrences are
// rows of their own (PLAN §5.10); a collection is a membership row for a live `col_` id, and "none" takes the item out.
import { addDays, centralDate } from "../domain/index.ts";
import type { CommandHandler } from "./handlers-core.ts";
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

  "plan.update": async (i: Fields & { id: string }, _c, x) => {
    const cur = await findItem(x, i.id);
    const to = i.date === undefined ? cur.day : checkDate(i.date);
    const o = await optionsOf(x, i, to);
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
    await materializeRepeat(x, row);
    if (o.collection !== undefined) await placeItem(x, row.id, o.collection);
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

  "plan.toggle_done": async (i: { id: string }, _c, x) => {
    const cur = await findItem(x, i.id);
    const done = cur.done_at === null;
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
