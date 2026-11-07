// The options of a plan item: time, repeat, linked item and collection. Time and link are columns of the item's own
// `plan_items` row; a repeat is a `repeats` row, and each day's occurrence is a `plan_items` row carrying its `repeat_id`
// (CONTRACT §data.repeat, one per repeat and day).
import {
  addDays,
  materialize,
  moveWrite,
  parseItemProps,
} from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { HandlerCtx } from "./handlers-core.ts";
import { fieldsOf, nextPos, planRepos, saveItem } from "./plan-days.ts";
import type { PlanItemTableRow } from "./plan-days.ts";

/** The kind name a plan item carries in the older item tables (item_props parsing, memberships). */
const ROW = "plan_items";

export type Fields = {
  title?: string;
  date?: string;
  time?: string;
  estimateMinutes?: number;
  repeat?: string;
  linked?: string;
  collection?: string;
};

type Rule = NonNullable<ReturnType<typeof parseItemProps>["repeat"]>;
type Linked = { kind: LinkedKind; id: string };
const LINKED_KINDS = ["note", "set", "weak_spot", "goal", "objective"] as const;
type LinkedKind = (typeof LINKED_KINDS)[number];
/** The older collection names a link was written with, and the kinds they stand for. */
const OLD_NAMES: Record<string, LinkedKind> = {
  notes: "note",
  sets: "set",
  weakspots: "weak_spot",
  exams: "goal",
  goals: "goal",
  objectives: "objective",
};

export type Options = {
  time?: string | null;
  repeat?: Rule | null;
  linked?: Linked | null;
  collection?: string;
};

/** Refuses an option the item_props schema would not take (a bad time, a repeat rule out of range); returns the parsed rule. */
function checkProps(
  p: Pick<Options, "time" | "repeat">,
): Rule | null | undefined {
  try {
    return parseItemProps({
      c: ROW,
      id: "x",
      time: null,
      repeat: null,
      linked: null,
      overrides: null,
      ...(p.time === undefined ? {} : { time: p.time }),
      ...(p.repeat === undefined ? {} : { repeat: p.repeat }),
      at: "x",
      v: 1,
    }).repeat;
  } catch (e) {
    throw new CommandError(400, `plan item options: ${(e as Error).message}`);
  }
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

/** A link is `<kind>/<id>` (for example `goal/goal_1`; the older `exams/e1` names work too); "none" clears. */
function parseLinked(text: string): Linked | null {
  const t = text.trim();
  if (t === "" || t === "none") return null;
  const i = t.indexOf("/");
  const name = t.slice(0, i);
  const kind = OLD_NAMES[name] ?? LINKED_KINDS.find((k) => k === name);
  if (i < 1 || i === t.length - 1 || !kind)
    throw new CommandError(
      400,
      `linked ${text} is not <note|set|weak_spot|goal|objective>/<id>`,
    );
  return { kind, id: t.slice(i + 1) };
}

/** How many days ahead a repeat is written (the morning job tops it up; every write is idempotent). */
const HORIZON = 14;

/** Writes the repeat's occurrences after the item's own day, skipping days that already hold one. */
export async function materializeRepeat(x: HandlerCtx, item: PlanItemTableRow) {
  if (!item.repeat_id) return;
  const rep = await planRepos(x).repeats.get(item.repeat_id);
  if (!rep) return;
  const found = materialize(
    {
      c: ROW,
      id: rep.id,
      time: null,
      repeat: rep.rule as Rule,
      linked: null,
      overrides: null,
      at: "x",
      v: 1,
    },
    { text: item.title, kind: "todo" },
    addDays(item.day, 1),
    addDays(item.day, HORIZON),
    "x",
  );
  const items = planRepos(x).planItems;
  for (const { date } of found) {
    // The row's id is fixed by repeat and day, so a repeat run twice (or after a restore) adds nothing.
    const id = `pli_${rep.id.slice(4)}-${date}`;
    if (await items.get(id, { deleted: true })) continue;
    await saveItem(
      x,
      {
        ...fieldsOf(item),
        id,
        day: date,
        pos: await nextPos(x, date),
        done_at: null,
      },
      null,
    );
  }
}

/** The repeats row for an item whose repeat is `rule`: the item's own, changed in place, or a new one. */
export async function saveRepeat(
  x: HandlerCtx,
  item: Pick<
    PlanItemTableRow,
    "title" | "minutes" | "time" | "day" | "linked_kind" | "linked_id"
  >,
  rule: Rule,
  repeatId: string | null,
  newId: string,
): Promise<string> {
  const repeats = planRepos(x).repeats;
  const cur = repeatId ? await repeats.get(repeatId) : null;
  const id = cur?.id ?? `rep_${newId}`;
  const r = await repeats.save(
    {
      id,
      title: item.title,
      minutes: item.minutes,
      time: item.time,
      rule,
      from_day: cur?.from_day ?? item.day,
      to_day: null,
      linked_kind: item.linked_kind,
      linked_id: item.linked_id,
    },
    cur ? cur.v : null,
  );
  if (!r.ok) throw new CommandError(409, "that repeat changed; try again");
  return id;
}

/** Puts the item in a collection (a membership row for a live `col_` id) or out ("none"); anything else is refused. */
async function moveOf(x: HandlerCtx, target: string) {
  const goal =
    target.trim() === "none" || target.trim() === "" ? null : target.trim();
  const live = new Set(
    (await tablesRepo(x.db, { clock: x.clock }).collectionRows.list()).map(
      (c) => c.id,
    ),
  );
  try {
    return moveWrite(goal, live);
  } catch (e) {
    throw new CommandError(400, (e as Error).message);
  }
}

/** Plan items have no collection column yet, so the collection stays a membership row (itemC plan_items). */
export async function placeItem(x: HandlerCtx, id: string, target: string) {
  const t = tablesRepo(x.db, { clock: x.clock });
  const w = await moveOf(x, target);
  if (w.kind === "row") {
    const cur = await t.memberships.get(ROW, id);
    const r = await t.memberships.save(
      {
        itemC: ROW,
        itemId: id,
        collectionId: w.collectionId,
      } as never,
      cur ? cur.v : null,
    );
    if (!r.ok) throw new CommandError(409, "that item changed; try again");
    return;
  }
  await t.memberships.remove(ROW, id);
}

/** The options in a create or update, checked before anything is written. */
export async function optionsOf(
  x: HandlerCtx,
  i: Fields,
  date: string,
): Promise<Options> {
  const o: Options = {};
  if (i.time !== undefined)
    o.time = i.time === "" || i.time === "none" ? null : i.time;
  if (i.repeat !== undefined)
    o.repeat = parseRepeat(i.repeat, date) as Rule | null;
  if (i.linked !== undefined) o.linked = parseLinked(i.linked);
  const rule = checkProps({ time: o.time, repeat: o.repeat });
  if (o.repeat) o.repeat = rule;
  if (i.collection !== undefined) {
    await moveOf(x, i.collection);
    o.collection = i.collection;
  }
  return o;
}
