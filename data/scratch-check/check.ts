// The scratch-copy parse check (S-53): parses every document of an ev4 export with v5's domain parsers and reports
// counts and error kinds only. Nothing read from a document (no id, title, value or message text) reaches the report.
import type { ParserRegistry } from '../docs/registry.ts';

export const EXPORT_KIND = 'ev-d1-export';

export interface CollectionReport {
  docs: number;
  ok: number;
  /** Documents of a collection no domain parser covers yet; counted, not parsed. */
  unchecked: number;
  /** Error kind -> count. */
  errors: Record<string, number>;
}
export type Report = Record<string, CollectionReport>;

/** The shape of the export, or the reason it is not one (a fixed phrase, never file content). */
export function exportProblem(exp: unknown): string | null {
  if (typeof exp !== 'object' || exp === null) return 'the file is not an export';
  const e = exp as { kind?: unknown; schema?: unknown; docs?: unknown };
  if (e.kind !== EXPORT_KIND || e.schema !== 1 || !Array.isArray(e.docs)) return 'the file is not an ev-d1-export, schema 1';
  return null;
}

// A parser message becomes a kind only if it is plain lowercase words after an entity prefix; the name that follows
// "field"/"key" is dropped, since a key can be anything. Anything else is "other".
function kindOf(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  const kind = msg.replace(/\b(field|key|fields|keys)\s+\S+/gi, '$1 _');
  return /^[a-z][a-z-]*: [a-z _,.-]{1,60}$/i.test(kind) ? kind.slice(0, 80) : 'other';
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/** Parses each document of a valid export. The caller has checked `exportProblem` first. */
export function checkExport(exp: { docs: unknown[] }, parsers: ParserRegistry): Report {
  const report: Report = {};
  for (const d of exp.docs) {
    const row = (typeof d === 'object' && d !== null ? d : {}) as { c?: unknown; data?: unknown };
    const c = typeof row.c === 'string' && /^[a-z0-9_-]{1,40}$/.test(row.c) ? row.c : '(bad collection name)';
    const r = (report[c] ??= { docs: 0, ok: 0, unchecked: 0, errors: {} });
    r.docs++;
    const parse = Object.hasOwn(parsers, c) ? parsers[c] : undefined;
    if (!parse) {
      r.unchecked++;
      continue;
    }
    let doc: unknown;
    try {
      doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch {
      bump(r.errors, 'not json');
      continue;
    }
    try {
      parse(doc);
      r.ok++;
    } catch (e) {
      bump(r.errors, kindOf(e));
    }
  }
  return report;
}

export const errorTotal = (report: Report): number =>
  Object.values(report).reduce((n, r) => n + Object.values(r.errors).reduce((a, b) => a + b, 0), 0);

/** The printable lines: one per collection, then a total. */
export function render(report: Report): string[] {
  const lines: string[] = [];
  let docs = 0;
  for (const c of Object.keys(report).sort()) {
    const r = report[c]!;
    docs += r.docs;
    const errs = Object.entries(r.errors)
      .sort()
      .map(([k, n]) => `${n} x ${k}`);
    lines.push(`${c}: ${r.docs} docs, ${r.ok} parsed, ${r.unchecked} unchecked, ${errs.length ? errs.join('; ') : 'no errors'}`);
  }
  lines.push(`total: ${docs} docs in ${Object.keys(report).length} collections, ${errorTotal(report)} errors`);
  return lines;
}
