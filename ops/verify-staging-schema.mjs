// Reads `wrangler d1 execute --json` output on stdin and fails unless every table and index that data/migrations
// creates exists on the staging D1. Prints the missing names.
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../data/migrations/", import.meta.url);
const sql = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort()
  .map((f) => readFileSync(new URL(f, dir), "utf8").replace(/--.*$/gm, ""))
  .join("\n");
const want = [
  ...sql.matchAll(
    /CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+IF NOT EXISTS\s+(\w+)/gi,
  ),
].map((m) => m[1]);
let input = "";
for await (const c of process.stdin) input += c;
const have = new Set(
  JSON.parse(input).flatMap((r) => r.results.map((x) => x.name)),
);
const missing = want.filter((n) => !have.has(n));
console.log(
  `${want.length} migration objects expected, ${missing.length} missing`,
);
if (missing.length) {
  console.error("missing on staging D1: " + missing.join(", "));
  process.exit(1);
}
