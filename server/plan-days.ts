// The days a manual plan item lives on (dayedits, PLAN §5.10): load, save with the document's version, find.
import { addDays } from "../domain/index.ts";
import { docsRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { HandlerCtx } from "./handlers-core.ts";

export type Day = Record<string, unknown> & {
  added?: Record<string, Record<string, unknown>>;
  checks?: Record<string, unknown>;
};
export type Found = { date: string; day: Day; v: number };

export const iso = (ms: number) => new Date(ms).toISOString();

export function checkDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || addDays(date, 0) !== date)
    throw new CommandError(400, `${date} is not a date`);
  return date;
}

export async function loadDay(
  x: HandlerCtx,
  date: string,
): Promise<{ day: Day; v: number } | null> {
  const doc = await docsRepo(x.db, { clock: x.clock }).get("dayedits", date);
  return doc ? { day: doc.data as Day, v: doc.v } : null;
}

/** Saves the day with `change` applied; a new day gets its envelope, an old one keeps it. */
export async function saveDay(
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
export async function findItem(x: HandlerCtx, id: string): Promise<Found> {
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
