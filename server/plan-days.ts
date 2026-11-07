// A plan item is a `plan_items` row (CONTRACT §data.tables, §data.gate): its day, position, time, link, repeat and tick
// (`done_at`) are columns. Every write is versioned, so a stale write is a 409. Reads and writes go through the plan repository.
import { addDays } from "../domain/index.ts";
import { tablesRepo, WriteRefused } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { HandlerCtx } from "./handlers-core.ts";

export function checkDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || addDays(date, 0) !== date)
    throw new CommandError(400, `${date} is not a date`);
  return date;
}

export type PlanItemTableRow = NonNullable<
  Awaited<ReturnType<ReturnType<typeof tablesRepo>["planItems"]["get"]>>
>;

export const planRepos = (x: HandlerCtx) =>
  tablesRepo(x.db, { clock: x.clock });

/** An item row as the gate takes it: the stamps are the gate's. */
export type ItemFields = Omit<PlanItemTableRow, "at" | "v" | "deleted_at">;
export const fieldsOf = (r: PlanItemTableRow): ItemFields => {
  const { at: _at, v: _v, deleted_at: _d, ...f } = r;
  return f;
};

export const REPEAT_CLASH = "that repeat already has an item on that day";

/** Saves an item row at the version read (null for a new one); a stale write is a 409, a clash with the repeat's day a 409 too. */
export async function saveItem(
  x: HandlerCtx,
  f: ItemFields,
  v: number | null,
): Promise<PlanItemTableRow> {
  const repo = planRepos(x).planItems;
  try {
    const r = await repo.save(f, v);
    if (!r.ok) {
      // The data layer reports a lost race and a unique-index clash alike: say which one it was.
      if (f.repeat_id && (await holder(x, f)))
        throw new CommandError(409, REPEAT_CLASH);
      throw new CommandError(409, "that item changed; try again");
    }
    return r.row;
  } catch (e) {
    if (e instanceof WriteRefused) throw new CommandError(409, e.message);
    if (
      e instanceof Error &&
      /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(e.message)
    )
      throw new CommandError(409, REPEAT_CLASH);
    throw e;
  }
}

/** Another row (live or removed) of the same repeat on the same day. */
async function holder(x: HandlerCtx, f: ItemFields) {
  const rows = await planRepos(x).planItems.list({
    where: { day: f.day },
    deleted: true,
  });
  return rows.some((r) => r.repeat_id === f.repeat_id && r.id !== f.id);
}

export async function findItem(
  x: HandlerCtx,
  id: string,
): Promise<PlanItemTableRow> {
  const row = await planRepos(x).planItems.get(id);
  if (!row) throw new CommandError(404, `no plan item ${id}`);
  return row;
}

/** The next free position on a day. */
export async function nextPos(x: HandlerCtx, day: string): Promise<number> {
  const rows = await planRepos(x).planItems.list({ where: { day } });
  return rows.reduce((m, r) => Math.max(m, r.pos + 1), 0);
}
