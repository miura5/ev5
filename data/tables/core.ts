// Shared row plumbing for the repositories in this folder: ms timestamps, JSON columns and the versioned write.
import type { D1Like } from "../docs/d1.ts";
import { gateRow } from "./gate.ts";

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
  /** Told about each stored row a read left out because it did not parse: table, row id and reason, never row text (default: logged). */
  onBad?: (b: { table: string; id: string; reason: string }) => void;
}

/** A list that left rows out says so: `left_out` counts the stored rows that did not parse (§data.gate). */
export type Listed<T> = T[] & { left_out: number };
export function listed<T>(rows: T[], leftOut: number): Listed<T> {
  // not enumerable: equality and JSON ignore it
  return Object.defineProperty(rows, "left_out", {
    value: leftOut,
  }) as Listed<T>;
}

/** Why a row did not parse, without its text: Zod issues as path and code, anything else as the error's name. */
export function reasonOf(e: unknown): string {
  const issues = (e as { issues?: unknown } | null)?.issues;
  if (Array.isArray(issues))
    return issues
      .map(
        (i: { path?: unknown[]; code?: string }) =>
          `${(i.path ?? []).join(".") || "(row)"}: ${i.code ?? "invalid"}`,
      )
      .join("; ");
  return e instanceof Error ? e.name : "unreadable";
}

/** Reports one unreadable row through `onBad`, or logs it when none was given. */
export function reportBad(
  opts: TablesOptions,
  table: string,
  id: string,
  e: unknown,
): void {
  const b = { table, id, reason: reasonOf(e) };
  if (opts.onBad) opts.onBad(b);
  else console.warn(`bad row left out: ${b.table}/${b.id}: ${b.reason}`);
}

const CONFLICT =
  /UNIQUE constraint failed|PRIMARY ?KEY|SQLITE_CONSTRAINT_(UNIQUE|PRIMARYKEY)/i;

/**
 * An insert that failed: true when it was a unique or primary-key violation (the row is already there: a conflict).
 * Any other failure is logged without row values and rethrown with its cause.
 */
export function insertConflict(table: string, e: unknown): true {
  const msg = e instanceof Error ? e.message : String(e);
  if (CONFLICT.test(msg)) return true;
  console.error(
    `insert into ${table} failed: ${e instanceof Error ? e.name : "error"}`,
  );
  throw new Error(`insert into ${table} failed`, { cause: e });
}

export type Input<T> = Omit<T, "at" | "v">;

/** Parses each stored row; a bad one is reported through `onBad` and left out, so one bad row cannot break a list. */
export function readRows<T>(
  table: string,
  rows: Raw[],
  parse: (r: Raw) => T,
  opts: TablesOptions,
): Listed<T> {
  const out: T[] = [];
  let left = 0;
  for (const r of rows) {
    try {
      out.push(parse(r));
    } catch (e) {
      left++;
      reportBad(opts, table, String(r.id ?? r.item_id ?? r.job_id ?? "?"), e);
    }
  }
  return listed(out, left);
}

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
    // Parse the row before anything is written: a row its domain rule refuses throws here and never reaches the table.
    const row = gateRow(table, () => result((current ?? 0) + 1, at));
    if (current === null) {
      const names = [...keyCols, ...cols, "at", "v"];
      try {
        await db
          .prepare(
            `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
          )
          .bind(...keyVals, ...vals, at, 1)
          .run();
      } catch (e) {
        insertConflict(table, e);
        return { ok: false, conflict: true, current: null }; // lost a race to another insert
      }
      return { ok: true, row };
    }
    const set = [...cols, "at", "v"].map((k) => `${k} = ?`).join(", ");
    const r = await db
      .prepare(`UPDATE ${table} SET ${set} WHERE ${where} AND v = ?`)
      .bind(...vals, at, current + 1, ...keyVals, current)
      .run();
    if (r.meta.changes === 0) return { ok: false, conflict: true, current };
    return { ok: true, row };
  }

  return { db, opts, all, first, putVersioned };
}
