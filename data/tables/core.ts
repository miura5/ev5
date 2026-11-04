// Shared row plumbing for the repositories in this folder: ms timestamps, JSON columns and the versioned write.
import type { D1Like } from "../docs/d1.ts";

export type Saved<T> =
  | { ok: true; row: T }
  | { ok: false; conflict: true; current: number | null };

export type Val = string | number | null;
export type Raw = Record<string, Val>;

export const json = (s: Val | undefined): unknown =>
  s === null || s === undefined ? null : JSON.parse(String(s));
export const iso = (ms: number): string => new Date(ms).toISOString();
export const text = (v: unknown): Val =>
  v === null || v === undefined ? null : JSON.stringify(v);

export interface TablesOptions {
  /** The Worker clock, in ms. */
  clock: () => number;
}

export type Input<T> = Omit<T, "at" | "v">;

export function core(db: D1Like, opts: TablesOptions) {
  const all = async (sql: string, ...args: Val[]): Promise<Raw[]> =>
    (
      await db
        .prepare(sql)
        .bind(...args)
        .all<Raw>()
    ).results;
  const first = (sql: string, ...args: Val[]) =>
    db
      .prepare(sql)
      .bind(...args)
      .first<Raw>();

  /** Insert (ifVersion null) or update at the version read; the row's own columns come from `cols`. */
  async function putVersioned<T>(
    table: string,
    keyCols: string[],
    keyVals: Val[],
    cols: string[],
    vals: Val[],
    ifVersion: number | null,
    result: (v: number, at: number) => T,
  ): Promise<Saved<T>> {
    const at = opts.clock();
    const where = keyCols.map((k) => `${k} = ?`).join(" AND ");
    const cur = await first(
      `SELECT v FROM ${table} WHERE ${where}`,
      ...keyVals,
    );
    const current = cur ? (cur.v as number) : null;
    if (current !== ifVersion) return { ok: false, conflict: true, current };
    if (current === null) {
      const names = [...keyCols, ...cols, "at", "v"];
      try {
        await db
          .prepare(
            `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
          )
          .bind(...keyVals, ...vals, at, 1)
          .run();
      } catch {
        return { ok: false, conflict: true, current: null }; // lost a race to another insert
      }
      return { ok: true, row: result(1, at) };
    }
    const set = [...cols, "at", "v"].map((k) => `${k} = ?`).join(", ");
    const r = await db
      .prepare(`UPDATE ${table} SET ${set} WHERE ${where} AND v = ?`)
      .bind(...vals, at, current + 1, ...keyVals, current)
      .run();
    if (r.meta.changes === 0) return { ok: false, conflict: true, current };
    return { ok: true, row: result(current + 1, at) };
  }

  return { db, opts, all, first, putVersioned };
}
export type Core = ReturnType<typeof core>;
