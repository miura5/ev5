// The export of every table (§data.export): `tables` is { count, sha256 } over each table's canonical rows
// and `rows` every row as written. The kind names v5's own file, so a
// restore refuses any other export (an old-app backup included). Read-only: it only SELECTs.
import type { D1Like } from "../d1.ts";
import { ALL_TABLES, type TableSpec } from "./tables.ts";

export const EXPORT_KIND = "ev5-export";
export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export interface Entry {
  count: number;
  sha256: string;
}
export type Manifest = Record<string, Entry>;
export interface Export {
  schema: 1;
  kind: typeof EXPORT_KIND;
  at: string;
  tables: Manifest;
  rows: Record<string, Row[]>;
}

const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (text: string): Promise<string> =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

const entry = async (lines: string[]): Promise<Entry> => ({
  count: lines.length,
  sha256: await sha256(lines.join("\n")),
});

/** A table's count and the SHA-256 over its rows (column values as a JSON array each) in primary-key order. */
export const tableEntry = (spec: TableSpec, rows: Row[]): Promise<Entry> =>
  entry(rows.map((r) => JSON.stringify(spec.columns.map((c) => r[c] ?? null))));

/** The whole manifest of rows already read, keyed by table. */
export async function manifestOf(
  rows: Record<string, Row[]>,
): Promise<{ tables: Manifest }> {
  const tables: Manifest = {};
  for (const spec of ALL_TABLES)
    tables[spec.name] = await tableEntry(spec, rows[spec.name] ?? []);
  return { tables };
}

/** Reads one table in key order; a table whose migration has not landed reads as empty. */
export async function readTable(db: D1Like, spec: TableSpec): Promise<Row[]> {
  try {
    const sql = `SELECT ${spec.columns.join(", ")} FROM ${spec.name} ORDER BY ${spec.orderBy.join(", ")}`;
    const { results } = await db.prepare(sql).all<Row>();
    return results;
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
}

export async function exportAll(
  db: D1Like,
  now: number = Date.now(),
): Promise<Export> {
  const rows: Record<string, Row[]> = {};
  for (const spec of ALL_TABLES) rows[spec.name] = await readTable(db, spec);
  const { tables } = await manifestOf(rows);
  return {
    schema: 1,
    kind: EXPORT_KIND,
    at: new Date(now).toISOString(),
    tables,
    rows,
  };
}

/** One line per table whose count or hash differs between two manifests; empty when they match. */
export function manifestDiffs(got: Manifest, want: Manifest): string[] {
  return [...new Set([...Object.keys(want), ...Object.keys(got)])]
    .sort()
    .flatMap((c) => {
      const g = got[c] ?? { count: 0, sha256: "" };
      const w = want[c] ?? { count: 0, sha256: "" };
      if (g.count !== w.count)
        return [`${c}: ${g.count} restored, ${w.count} in the export`];
      return g.sha256 === w.sha256 ? [] : [`${c}: the hash differs`];
    });
}
