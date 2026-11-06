// Dates and the prep plan (CONTRACT §cmd.registry, §data.protocol). A date Matt adds is a `goals` row (§data.tables),
// joined to objectives by link rows (§data.links); an older `dates` entry is changed by an override in `dateedits` until
// the backfill (a Canvas entry's fields are marks only canvas-sync may write). Approving a prep plan makes it the plan in force in `planedits/<exam>`; putting it away marks
// it retired there (§delete.soft: the plan document stays). Every write carries the document's version, so a stale one is a 409.
import {
  addDays,
  centralDate,
  DATE_KINDS,
  endedReason,
  lastDay,
  planEnded,
} from "../domain/index.ts";
import { docsRepo, tablesRepo, WriteRefused } from "../data/index.ts";
import { goalKey, linkKey } from "./ids.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";

type Doc = Record<string, any>;

const iso = (ms: number) => new Date(ms).toISOString();

function checkDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || addDays(date, 0) !== date)
    throw new CommandError(400, `${date} is not a date`);
  return date;
}

async function save(
  x: HandlerCtx,
  c: string,
  id: string,
  doc: Doc,
  v: number | null,
) {
  const r = await docsRepo(x.db, { clock: x.clock }).save(
    c,
    id,
    JSON.stringify(doc),
    v,
  );
  if (!r.ok) throw new CommandError(409, "that changed; try again");
}

/** Reads a document, runs `change` on a copy (a new one gets its envelope) and saves it with the version read. */
async function edit(
  x: HandlerCtx,
  [c, id]: [string, string],
  fresh: Doc,
  source: string,
  change: (d: Doc) => void,
) {
  const cur = await docsRepo(x.db, { clock: x.clock }).get(c, id);
  const now = iso(x.clock());
  const doc: Doc = cur
    ? { ...(cur.data as Doc) }
    : { writer: "page", at: now, source, ...fresh };
  change(doc);
  doc.updatedAt = now;
  await save(x, c, id, doc, cur ? cur.v : null);
}

/** A kind from the registry (domain/goal), else the default "other". */
function checkKind(kind: string | undefined): string {
  if (kind === undefined) return "other";
  if (!Object.hasOwn(DATE_KINDS, kind))
    throw new CommandError(400, `${kind} is not a kind of date`);
  return kind;
}

async function need(x: HandlerCtx, c: string, id: string): Promise<Doc> {
  const doc = await docsRepo(x.db, { clock: x.clock }).get(c, id);
  if (!doc) throw new CommandError(404, `no ${c} entry ${id}`);
  return doc.data as Doc;
}

/** The plan's date, whose `planedits` document says which plan is in force and which are put away. */
async function examOf(x: HandlerCtx, id: string): Promise<string> {
  const exam = (await need(x, "plans", id)).exam;
  if (typeof exam !== "string" || !exam)
    throw new CommandError(400, `plan ${id} has no date`);
  return exam;
}

const planEdit = (
  x: HandlerCtx,
  exam: string,
  source: string,
  change: (d: Doc) => void,
) => edit(x, ["planedits", exam], { schema: 2, ticks: {} }, source, change);

/** Puts a plan in force in `planedits/<exam>` (un-retiring it). Shared with the prep-plan job's apply step, so one tap
 * on the job's Approve does what the command does. Repeating it changes nothing. */
export async function putPlanInForce(
  x: Pick<HandlerCtx, "db" | "clock">,
  exam: string,
  id: string,
  source: string,
) {
  const cur = await docsRepo(x.db, { clock: x.clock }).get("planedits", exam);
  const d = cur?.data as Doc | undefined;
  if (d?.plan === id && !(d.retired && id in d.retired)) return;
  await planEdit(x as HandlerCtx, exam, source, (d) => {
    const { [id]: _gone, ...retired } = (d.retired ?? {}) as Doc;
    d.plan = id;
    if (Object.keys(retired).length) d.retired = retired;
    else delete d.retired;
  });
}

export const dateHandlers: Record<string, CommandHandler> = {
  "date.create": async (
    i: { title: string; date: string; kind?: string; objectives?: string[] },
    _c,
    x,
  ) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const id = goalKey(x.newId());
    const made = await t.goals.save(
      {
        id,
        collection_id: null,
        title: i.title,
        kind: checkKind(i.kind),
        date: checkDate(i.date),
        status: "open",
        score: null,
        created_by: "user",
      },
      null,
    );
    if (!made.ok) throw new CommandError(409, "that changed; try again");
    try {
      for (const objective of new Set(i.objectives ?? []))
        await t.links.save(
          {
            id: linkKey(x.newId()),
            from_kind: "objective",
            from_id: objective,
            to_kind: "goal",
            to_id: id,
            by: "user",
            note: null,
          },
          null,
        );
    } catch (e) {
      if (!(e instanceof WriteRefused)) throw e;
      await t.goals.remove(id, made.row.v); // no half-made date
      throw new CommandError(404, e.message);
    }
    return { id, date: i.date };
  },

  "date.update": async (
    i: { id: string; title?: string; date?: string; kind?: string },
    _c,
    x,
  ) => {
    const date = i.date === undefined ? undefined : checkDate(i.date);
    const kind = i.kind === undefined ? undefined : checkKind(i.kind);
    const goals = tablesRepo(x.db, { clock: x.clock }).goals;
    // An older date copied by the backfill is the goal `goal_<id>`; from then on the goal is the one that changes.
    const asGoal = i.id.startsWith("goal_")
      ? i.id
      : (await goals.get(`goal_${i.id}`))
        ? `goal_${i.id}`
        : undefined;
    if (asGoal) {
      const cur = await goals.get(asGoal);
      if (!cur) throw new CommandError(404, `no date ${i.id}`);
      const { at: _at, v, deleted_at: _d, ...fields } = cur;
      const r = await goals.save(
        {
          ...fields,
          ...(date ? { date } : {}),
          ...(i.title ? { title: i.title } : {}),
          ...(kind ? { kind } : {}),
        },
        v,
      );
      if (!r.ok) throw new CommandError(409, "that changed; try again");
      return { id: i.id };
    }
    await need(x, "dates", i.id);
    // An older date not yet copied to a goal keeps its kind; only a goal's kind changes.
    if (kind) throw new CommandError(409, "this date's kind cannot be changed yet");
    await edit(
      x,
      ["dateedits", i.id],
      { schema: 1 },
      "v5/command:date.update",
      (d) => {
        d.overrides = {
          ...d.overrides,
          ...(date ? { date } : {}),
          ...(i.title ? { title: i.title } : {}),
        };
      },
    );
    return { id: i.id };
  },

  "plan.approve": async (i: { id: string }, _c, x) => {
    const exam = await examOf(x, i.id);
    const days = (await need(x, "plans", i.id)).days;
    const last = lastDay(
      Array.isArray(days)
        ? days.flatMap((d: Doc) =>
            typeof d?.date === "string" ? [d.date] : [],
          )
        : [],
    );
    if (last !== undefined && planEnded([last], centralDate(x.clock())))
      throw new CommandError(409, endedReason(last));
    await putPlanInForce(x, exam, i.id, "v5/command:plan.approve");
    return { id: i.id, exam, inForce: true };
  },

  "plan.put_away": async (i: { id: string }, _c, x) => {
    const exam = await examOf(x, i.id);
    await planEdit(x, exam, "v5/command:plan.put_away", (d) => {
      if (d.plan === i.id) delete d.plan;
      d.retired = { ...d.retired, [i.id]: { at: iso(x.clock()), by: "Matt" } };
    });
    return { id: i.id, exam, inForce: false };
  },
};
