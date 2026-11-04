// The plan-item commands (CONTRACT §cmd.registry, §data.protocol): a manual item is a `dayedits.added` entry made by
// Matt (PLAN §5.10), a tick is a `dayedits.checks` entry, and a time goes to `item_props`. Every write goes through the
// docs protocol with the document's version, so a stale write is a 409. A repeat, a link and a time go to
// `item_props`; a repeat also materializes the next days' occurrences into `dayedits.added` under `rep-<id>-<date>`
// (PLAN §5.10); a collection is a membership row, or ev4's `course` field for a `course:<key>` target.
import { addDays, centralDate } from "../domain/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler } from "./handlers-core.ts";
import { checkDate, findItem, iso, loadDay, saveDay } from "./plan-days.ts";
import type { Day } from "./plan-days.ts";
import { applyOptions, optionsOf } from "./plan-options.ts";
import type { Fields } from "./plan-options.ts";

export const planHandlers: Record<string, CommandHandler> = {
  "plan.create": async (i: Fields & { title: string }, _c, x) => {
    const date = checkDate(i.date ?? centralDate(x.clock()));
    const options = await optionsOf(x, i, date);
    const id = x.newId();
    await saveDay(
      x,
      "v5/command:plan.create",
      date,
      await loadDay(x, date),
      (d) => {
        d.added = {
          ...d.added,
          [id]: {
            text: i.title,
            kind: "todo",
            ...(i.estimateMinutes ? { minutes: i.estimateMinutes } : {}),
            at: iso(x.clock()),
            by: "Matt",
          },
        };
      },
    );
    await applyOptions(x, id, date, options);
    return { id, date };
  },

  "plan.update": async (i: Fields & { id: string }, _c, x) => {
    const from = await findItem(x, i.id);
    const to = i.date === undefined ? from.date : checkDate(i.date);
    const options = await optionsOf(x, i, to);
    const item = {
      ...(from.day.added as Record<string, Record<string, unknown>>)[i.id],
    };
    if (i.title !== undefined) item.text = i.title;
    if (i.estimateMinutes !== undefined) item.minutes = i.estimateMinutes;
    const put = (d: Day) => void (d.added = { ...d.added, [i.id]: item });
    // A move writes the new day first, so a failure between the two leaves the item twice, never lost.
    if (to !== from.date)
      await saveDay(x, "v5/command:plan.update", to, await loadDay(x, to), put);
    await saveDay(x, "v5/command:plan.update", from.date, from, (d) => {
      if (to === from.date) return put(d);
      // Nothing is removed (§delete.soft): the old day marks the item skipped and the new day holds it.
      d.skipped = {
        ...(d.skipped as object),
        [i.id]: { at: iso(x.clock()), by: "Matt" },
      };
    });
    await applyOptions(x, i.id, to, options);
    return { id: i.id, date: to };
  },

  "plan.move_tomorrow": async (i: { id: string }, c, x) => {
    const from = await findItem(x, i.id);
    return planHandlers["plan.update"]?.(
      { id: i.id, date: addDays(from.date, 1) } as never,
      c,
      x,
    );
  },

  "plan.toggle_done": async (i: { id: string }, _c, x) => {
    const f = await findItem(x, i.id);
    let done = false;
    await saveDay(x, "v5/command:plan.toggle_done", f.date, f, (d) => {
      const { [i.id]: was, ...rest } = (d.checks ?? {}) as Record<
        string,
        unknown
      >;
      done = was === undefined;
      d.checks = done
        ? { ...rest, [i.id]: { at: iso(x.clock()), by: "Matt" } }
        : rest;
    });
    return { id: i.id, done };
  },

  // Carried out by the screen (it opens the session); the server only agrees.
  "plan.start": async () => ({ client: true }),
  "plan.start_next": async () => ({ client: true }),
};
