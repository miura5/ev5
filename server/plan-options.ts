// The options of a plan item: time, repeat, linked item (item_props) and collection. A repeat materializes each
// day's occurrence into `dayedits.added` under `rep-<id>-<date>` (PLAN §5.10), so ev4 sees it after a rollback.
import {
  addDays,
  materialize,
  missingOccurrences,
  moveWrite,
  parseItemProps,
} from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { HandlerCtx } from "./handlers-core.ts";
import { findItem, iso, loadDay, saveDay } from "./plan-days.ts";

export type Fields = {
  title?: string;
  date?: string;
  time?: string;
  estimateMinutes?: number;
  repeat?: string;
  linked?: string;
  collection?: string;
};

type Patch = {
  time?: string | null;
  repeat?: unknown;
  linked?: { c: string; id: string } | null;
};

/** Refuses an option the item_props schema would not take (a bad time, a repeat rule out of range). */
function checkProps(p: Patch) {
  try {
    parseItemProps({
      c: "dayedits",
      id: "x",
      time: null,
      repeat: null,
      linked: null,
      overrides: null,
      ...p,
      at: "x",
      v: 1,
    });
  } catch (e) {
    throw new CommandError(400, `plan item options: ${(e as Error).message}`);
  }
}

/** Saves the item's `item_props` row with `patch` applied; what the patch leaves out stays. */
async function saveProps(x: HandlerCtx, id: string, patch: Patch) {
  const props = tablesRepo(x.db, { clock: x.clock }).itemProps;
  const cur = await props.get("dayedits", id);
  const next = {
    c: "dayedits",
    id,
    time: cur?.time ?? null,
    repeat: cur?.repeat ?? null,
    linked: cur?.linked ?? null,
    overrides: cur?.overrides ?? null,
    ...patch,
  };
  checkProps(next);
  const r = await props.save(next as never, cur ? cur.v : null);
  if (!r.ok) throw new CommandError(409, "that item changed; try again");
  return r;
}

/** "daily", "weekdays", "weekly:1,3,5" (0 = Sunday), "every:3" (from the item's day) or a rule as JSON; "none" clears. */
function parseRepeat(text: string, date: string): unknown {
  const t = text.trim();
  if (t === "" || t === "none") return null;
  if (t.startsWith("{")) {
    try {
      return JSON.parse(t);
    } catch {
      throw new CommandError(400, "repeat is not valid JSON");
    }
  }
  const [kind, arg] = t.split(":");
  if (kind === "daily" || kind === "weekdays") return { kind };
  if (kind === "weekly" && arg)
    return { kind, days: arg.split(",").map((d) => Number(d)) };
  if (kind === "every" && arg) return { kind, n: Number(arg), start: date };
  throw new CommandError(400, `repeat ${text} is not a rule`);
}

/** A link is `<collection>/<id>` (for example `exams/e1`); "none" clears. */
function parseLinked(text: string): { c: string; id: string } | null {
  const t = text.trim();
  if (t === "" || t === "none") return null;
  const i = t.indexOf("/");
  if (i < 1 || i === t.length - 1)
    throw new CommandError(400, `linked ${text} is not <collection>/<id>`);
  return { c: t.slice(0, i), id: t.slice(i + 1) };
}

/** How many days ahead a repeat is written (the morning job tops it up; every write is idempotent). */
const HORIZON = 14;

/** Writes the repeat's occurrences after the item's own day into each day's `added`, skipping ones already there. */
async function materializeRepeat(
  x: HandlerCtx,
  id: string,
  date: string,
  item: Record<string, unknown> = {},
) {
  const cur = await tablesRepo(x.db, { clock: x.clock }).itemProps.get(
    "dayedits",
    id,
  );
  if (!cur?.repeat) return;
  item = (await findItem(x, id)).day.added![id]!;
  const { text, kind, minutes, course } = item as {
    text: string;
    kind: "todo";
    minutes?: number;
    course?: string;
  };
  const found = materialize(
    cur,
    { text, kind, ...(minutes ? { minutes } : {}), ...(course ? { course } : {}) },
    addDays(date, 1),
    addDays(date, HORIZON),
    iso(x.clock()),
  );
  for (const d of new Set(found.map((o) => o.date))) {
    const day = await loadDay(x, d);
    const todo = missingOccurrences(
      day?.day ?? null,
      found.filter((o) => o.date === d),
    );
    if (todo.length === 0) continue;
    await saveDay(x, "v5/command:plan.repeat", d, day, (dd) => {
      dd.added = {
        ...dd.added,
        ...Object.fromEntries(todo.map((o) => [o.key, o.entry])),
      };
    });
  }
}

/** Puts the item in a collection (a membership row), in a course (`course:<key>`: ev4's field) or out ("none"). */
async function moveOf(x: HandlerCtx, target: string) {
  const goal = target.trim() === "none" || target.trim() === "" ? null : target.trim();
  const live = new Set(
    (await tablesRepo(x.db, { clock: x.clock }).collections.list()).map((c) => c.id),
  );
  try {
    return moveWrite(goal, live);
  } catch (e) {
    throw new CommandError(400, (e as Error).message);
  }
}

async function placeItem(x: HandlerCtx, id: string, target: string) {
  const t = tablesRepo(x.db, { clock: x.clock });
  const w = await moveOf(x, target);
  if (w.kind === "row") {
    const cur = await t.memberships.get("dayedits", id);
    const r = await t.memberships.save(
      { itemC: "dayedits", itemId: id, collectionId: w.collectionId } as never,
      cur ? cur.v : null,
    );
    if (!r.ok) throw new CommandError(409, "that item changed; try again");
    return;
  }
  await t.memberships.remove("dayedits", id);
  if (w.kind === "course") {
    const course = w.course;
    const f = await findItem(x, id);
    await saveDay(x, "v5/command:plan.update", f.date, f, (d) => {
      const e = (d.added as Record<string, Record<string, unknown>>)[id];
      if (e) e.course = course;
    });
  }
}

export type Options = { patch: Patch; collection?: string };

/** The options in a create or update, checked before anything is written. */
export async function optionsOf(x: HandlerCtx, i: Fields, date: string): Promise<Options> {
  const patch: Patch = {};
  if (i.time !== undefined) patch.time = i.time === "" || i.time === "none" ? null : i.time;
  if (i.repeat !== undefined) patch.repeat = parseRepeat(i.repeat, date);
  if (i.linked !== undefined) patch.linked = parseLinked(i.linked);
  checkProps(patch);
  if (i.collection !== undefined) await moveOf(x, i.collection);
  return i.collection === undefined
    ? { patch }
    : { patch, collection: i.collection };
}

/** Writes the options once the item is on its day: its props row, its repeat's days and its collection. */
export async function applyOptions(x: HandlerCtx, id: string, date: string, o: Options) {
  if (Object.keys(o.patch).length > 0) await saveProps(x, id, o.patch);
  // A repeat is topped up on every change, so a title or a date change reaches the days not yet written.
  await materializeRepeat(x, id, date);
  if (o.collection !== undefined) await placeItem(x, id, o.collection);
}
