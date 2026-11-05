# Restore drills

Rules: §data.export, §data.tables, §hard.data-never-lost, §hard.live-on-matts-word, §sec.live-data.

## Automated, every CI run (local, synthetic data only)

`data/export/drill.test.ts` (part of `npm test`). For each table in the export manifest (`data/export/tables.ts`):
seed synthetic rows into a migrated in-memory SQLite, export, send the export through JSON, restore into a fresh
scratch, then check the counts, the SHA-256 per table and per `docs` collection, and the canonical (sorted-key) JSON of
every row. Also: one record holding every table, a tampered export refused before anything is written, a restore into
a non-empty scratch refused, and a changed row in any table caught by that table's hash. A table whose migration has
not landed (`views`) exports as empty and is drilled as empty until it does. A new table is covered the moment it is
added to `tables.ts`; the test fails for a table in a migration that is not listed there.

## Time Travel restore on staging (needs Cloudflare credentials: left for a GitHub workflow)

Not run by builders. A workflow on the staging token (environment `staging`, never `live`) runs, after
`npm ci`:

    bash ops/restore-drill/time-travel.sh ev5-staging drill-out

It exports the manifest, notes a Time Travel bookmark, writes one marked `docs` row, restores to the bookmark, exports
again and requires the two manifests equal. The script refuses any database other than `ev5-staging`. Upload
`drill-out/` as the proof and record the run link as the S-83 decision in the Chart. The workflow file itself
(`.github/workflows/`) is outside this task's slice and is still to be written.

Restoring live is never part of a drill: it happens only on Matt's word with him present (§data.export).
