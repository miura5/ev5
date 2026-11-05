// node ops/restore-drill/manifest.mjs ev5-staging <out.json>: the export manifest (counts and SHA-256 per table and
// per `docs` collection, no content) of the remote staging D1, read through wrangler with data's own exportAll.
// Run by time-travel.sh in the staging workflow.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { exportAll } from "../../data/index.ts";

const [db, out] = process.argv.slice(2);
if (db !== "ev5-staging" || !out) {
  console.error("usage: manifest.mjs ev5-staging <out.json>");
  process.exit(2);
}
const remote = (sql) =>
  JSON.parse(
    execFileSync(
      "npx",
      ["wrangler", "d1", "execute", db, "--remote", "--json", "--command", sql],
      {
        encoding: "utf8",
        maxBuffer: 1 << 28,
      },
    ),
  )[0].results;
// Only exportAll's own SELECTs (no bound values) go through here.
const d1 = {
  prepare: (sql) => ({ all: async () => ({ results: remote(sql) }) }),
};
const x = await exportAll(d1, 0);
writeFileSync(
  out,
  JSON.stringify({ collections: x.collections, tables: x.tables }, null, 1),
);
