// node ops/restore-drill/manifest.mjs ev5-staging <out.json>: the export manifest (counts and SHA-256 per table and
// per `docs` collection, no content) of the remote staging D1, read through wrangler with data's own exportAll.
// Run by time-travel.sh in the staging workflow.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { exportAll } from "../../data/index.ts";
import { checkPictures } from "../../data/export/index.ts";
import { r2Bucket } from "./r2-bucket.mjs";

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

// Note pictures (§data.note-images): read each back from the staging bucket against its files row. Skipped, with a
// message, when no R2 credentials are set, so CI never needs them. A missing or changed picture fails the drill;
// orphans are reported only.
const bucket = r2Bucket(process.env.R2_BUCKET ?? "ev5-staging-images");
if (!bucket) {
  console.log(
    "skip pictures: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID to check them in R2",
  );
} else {
  const r = await checkPictures(x.rows.files ?? [], bucket);
  for (const o of r.orphans) console.log(`orphan ${o}`);
  for (const p of r.problems) console.error(`FAIL ${p}`);
  console.log(
    `pictures: ${r.checked} checked, ${r.problems.length} problems, ${r.orphans.length} orphans`,
  );
  if (r.problems.length) process.exit(1);
}
