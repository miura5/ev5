// Dates and the prep plan (CONTRACT §cmd.registry, §data.protocol). Every date is a `goals` row (§data.tables),
// joined to objectives by link rows (§data.links). Approving a prep plan sets its `plans` row in force (the goal's other
// plan in force is put away); putting it away sets it put away (§delete.soft: the row and its items stay). Both go through the
// gate, the same path as the job's decision, and a stale version is a 409.
import {
  addDays,
  centralDate,
  DATE_KINDS,
  endedReason,
  planEnded,
} from "../domain/index.ts";
import { tablesRepo, WriteRefused } from "../data/index.ts";
import { setPlanState } from "../jobs/index.ts";
import { goalKey, linkKey } from "./ids.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";

function checkDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || addDays(date, 0) !== date)
    throw new CommandError(400, `${date} is not a date`);
  return date;
}

/** A kind from the registry (domain/goal), else the default "other". */
function checkKind(kind: string | undefined): string {
  if (kind === undefined) return "other";
  if (!Object.hasOwn(DATE_KINDS, kind))
    throw new CommandError(400, `${kind} is not a kind of date`);
  return kind;
}

/** Moves a plan row to a state through the path the job's decision uses (§data.gate); a plan that is not there is a 404. */
async function movePlan(
  x: HandlerCtx,
  id: string,
  state: "in_force" | "put_away",
) {
  try {
    const row = await setPlanState(x.db, x.clock, id, state);
    if (row) return row;
  } catch (e) {
    if (e instanceof WriteRefused) throw new CommandError(409, e.message);
    if (/changed; try again/.test(String(e)))
      throw new CommandError(409, "that changed; try again");
    throw e;
  }
  throw new CommandError(404, `no plan ${id}`);
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
    const cur = await goals.get(i.id);
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
  },

  "plan.approve": async (i: { id: string }, _c, x) => {
    const plan = await tablesRepo(x.db, { clock: x.clock }).plans.get(i.id);
    if (!plan) throw new CommandError(404, `no plan ${i.id}`);
    // The plan's last day is its `to_day`; a plan whose days have all passed is not put in force (one in force stays).
    if (
      plan.state !== "in_force" &&
      planEnded([plan.to_day], centralDate(x.clock()))
    )
      throw new CommandError(409, endedReason(plan.to_day));
    await movePlan(x, i.id, "in_force");
    return { id: i.id, exam: plan.goal_id, inForce: true };
  },

  "plan.put_away": async (i: { id: string }, _c, x) => {
    const plan = await movePlan(x, i.id, "put_away");
    return { id: i.id, exam: plan.goal_id, inForce: false };
  },
};
