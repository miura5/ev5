// The plan-item commands (CONTRACT §cmd.registry, §data.protocol): a manual item is a `dayedits.added` entry made by
// Matt (PLAN §5.10), a tick is a `dayedits.checks` entry, and a time goes to `item_props`. Every write goes through the
// docs protocol with the document's version, so a stale write is a 409. A repeat, a link and a collection wait for
// their own tasks and answer 400 here rather than being dropped.
import { addDays, centralDate } from "../domain/index.ts";
import { docsRepo, tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";

type Fields = {
  title?: string;
  date?: string;
  time?: string;
  estimateMinutes?: number;
  repeat?: string;
  linked?: string;
  collection?: string;
};
type Day = Record<string, unknown> & {
  added?: Record<string, Record<string, unknown>>;
  checks?: Record<string, unknown>;
};
type Found = { date: string; day: Day; v: number };

const iso = (ms: number) => new Date(ms).toISOString();

function checkDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || addDays(date, 0) !== date)
    throw new CommandError(400, `${date} is not a date`);
  return date;
}

async function loadDay(
  x: HandlerCtx,
  date: string,
): Promise<{ day: Day; v: number } | null> {
  const doc = await docsRepo(x.db, { clock: x.clock }).get("dayedits", date);
  return doc ? { day: doc.data as Day, v: doc.v } : null;
}

/** Saves the day with `change` applied; a new day gets its envelope, an old one keeps it. */
async function saveDay(
  x: HandlerCtx,
  source: string,
  date: string,
  cur: { day: Day; v: number } | null,
  change: (d: Day) => void,
): Promise<void> {
  const now = iso(x.clock());
  const day: Day = cur
    ? { ...cur.day }
    : { schema: 1, writer: "page", at: now, source, date };
  change(day);
  day.updatedAt = now;
  const r = await docsRepo(x.db, { clock: x.clock }).save(
    "dayedits",
    date,
    JSON.stringify(day),
    cur ? cur.v : null,
  );
  if (!r.ok) throw new CommandError(409, "that day changed; try again");
}

/** The day a manual plan item is on (a day that skipped it, because it moved, does not count). */
async function findItem(x: HandlerCtx, id: string): Promise<Found> {
  const { results } = await x.db
    .prepare(
      "SELECT id, data, v FROM docs WHERE c = 'dayedits' AND data LIKE ?",
    )
    .bind(`%${JSON.stringify(id).slice(1, -1)}%`)
    .all<{ id: string; data: string; v: number }>();
  for (const r of results) {
    const day = JSON.parse(r.data) as Day;
    const skipped = (day.skipped as Record<string, unknown> | undefined)?.[id];
    if (day.added?.[id] && !skipped) return { date: r.id, day, v: r.v };
  }
  throw new CommandError(404, `no plan item ${id}`);
}

async function setTime(x: HandlerCtx, id: string, time: string) {
  const props = tablesRepo(x.db, { clock: x.clock }).itemProps;
  const cur = await props.get("dayedits", id);
  const r = await props.save(
    {
      c: "dayedits",
      id,
      time,
      repeat: null,
      linked: null,
      overrides: null,
      ...(cur
        ? { repeat: cur.repeat, linked: cur.linked, overrides: cur.overrides }
        : {}),
    },
    cur ? cur.v : null,
  );
  if (!r.ok) throw new CommandError(409, "that item changed; try again");
}

function refuseUnsupported(f: Fields) {
  for (const k of ["repeat", "linked", "collection"] as const)
    if (f[k] !== undefined)
      throw new CommandError(400, `${k} is not supported on a plan item yet`);
}

export const planHandlers: Record<string, CommandHandler> = {
  "plan.create": async (i: Fields & { title: string }, _c, x) => {
    refuseUnsupported(i);
    const date = checkDate(i.date ?? centralDate(x.clock()));
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
    if (i.time) await setTime(x, id, i.time);
    return { id, date };
  },

  "plan.update": async (i: Fields & { id: string }, _c, x) => {
    refuseUnsupported(i);
    const from = await findItem(x, i.id);
    const to = i.date === undefined ? from.date : checkDate(i.date);
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
    if (i.time) await setTime(x, i.id, i.time);
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
