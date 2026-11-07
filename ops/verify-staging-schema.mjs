// Reads `wrangler d1 execute --json` output on stdin and fails unless every table and index that data/migrations
// creates exists on the staging D1, and every table has every column the migrations give it (CREATE TABLE columns plus
// ALTER TABLE ... ADD COLUMN). Rows are { name, type, col }: type table/index with col '', or type 'column' with name =
// the table and col = the column (from pragma_table_info). Prints what is missing.
import { readdirSync, readFileSync } from "node:fs";

// A quoted SQL name ("by", `by`, [by]) as pragma_table_info reports it: without the quotes.
const unquote = (w) => w.replace(/^(["`[])(.*)[\]"`]$/, "$2");

// The rows in `wrangler d1 execute --json` output. On a failed query wrangler prints an error object, not an array:
// throw with its message, so the step says why it failed.
export function rowsFrom(json) {
  const out = JSON.parse(json);
  if (!Array.isArray(out)) throw new Error("wrangler d1 execute failed: " + JSON.stringify(out.error ?? out));
  return out.flatMap((r) => r.results);
}

// Column names a migration SQL text gives each table.
export function wantedColumns(sql) {
  const cols = new Map();
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\)\s*;/gi)) {
    const names = [];
    let depth = 0;
    let cur = "";
    const parts = [];
    for (const ch of m[2]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(cur);
        cur = "";
      } else cur += ch;
    }
    parts.push(cur);
    for (const p of parts) {
      const w = unquote(p.trim().split(/\s+/)[0]);
      if (w && !/^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)$/i.test(w)) names.push(w);
    }
    cols.set(m[1], names);
  }
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+("\w+"|`\w+`|\[\w+\]|\w+)/gi)) {
    cols.set(m[1], [...(cols.get(m[1]) ?? []), unquote(m[2])]);
  }
  return cols;
}

export function missingFromStaging(sql, rows) {
  const want = [
    ...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+IF NOT EXISTS\s+(\w+)/gi),
  ].map((m) => m[1]);
  const have = new Set(rows.filter((r) => r.type !== "column").map((r) => r.name));
  const haveCols = new Set(
    rows.filter((r) => r.type === "column").map((r) => `${r.name}.${r.col}`),
  );
  const missing = want.filter((n) => !have.has(n));
  const missingCols = [];
  for (const [t, names] of wantedColumns(sql))
    for (const c of names) if (!haveCols.has(`${t}.${c}`)) missingCols.push(`${t}.${c}`);
  return { want, missing, missingCols };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dir = new URL("../data/migrations/", import.meta.url);
  const sql = readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => readFileSync(new URL(f, dir), "utf8").replace(/--.*$/gm, ""))
    .join("\n");
  let input = "";
  for await (const c of process.stdin) input += c;
  const rows = rowsFrom(input);
  const { want, missing, missingCols } = missingFromStaging(sql, rows);
  console.log(
    `${want.length} migration objects expected, ${missing.length} missing; ${missingCols.length} columns missing`,
  );
  if (missing.length) console.error("missing on staging D1: " + missing.join(", "));
  if (missingCols.length) console.error("missing columns on staging D1: " + missingCols.join(", "));
  if (missing.length || missingCols.length) process.exit(1);
}
