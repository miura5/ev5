#!/usr/bin/env bash
# Time Travel restore drill on STAGING D1 only (§data.export, §hard.live-on-matts-word, §deliver.window).
# Needs Cloudflare credentials, so it runs only from a GitHub workflow (staging token), never from a builder.
# Usage: time-travel.sh <staging-db-name> <export-dir>
#   1. exports every table (the manifest before),
#   2. notes a Time Travel bookmark,
#   3. makes a marked change (one row in `docs`, collection `drill`),
#   4. restores the database to the bookmark,
#   5. exports again and requires the manifest to equal the one from step 1 (the marked row gone).
# It refuses any name that is not the staging database, so it can never touch live.
set -euo pipefail
db=${1:?staging database name}; out=${2:?export directory}
[ "$db" = "ev5-staging" ] || { echo "refusing: $db is not ev5-staging" >&2; exit 2; }
: "${CLOUDFLARE_API_TOKEN:?set by the workflow}" "${CLOUDFLARE_ACCOUNT_ID:?set by the workflow}"
mkdir -p "$out"
manifest() { # table counts and hashes of the whole database, from the export
  node ops/restore-drill/manifest.mjs "$db" "$1"
}
manifest "$out/before.json"
bookmark=$(npx wrangler d1 time-travel info "$db" --json | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).bookmark))')
echo "bookmark: $bookmark"
npx wrangler d1 execute "$db" --remote --command \
  "INSERT INTO docs (c,id,data,at,v) VALUES ('drill','marker','{}',strftime('%s','now')*1000,1)"
npx wrangler d1 time-travel restore "$db" --bookmark "$bookmark"
manifest "$out/after.json"
if cmp -s "$out/before.json" "$out/after.json"; then
  echo "ok   time travel restore: manifest equals the one before the change"
else
  echo "FAIL time travel restore: manifest differs" >&2
  diff "$out/before.json" "$out/after.json" >&2 || true
  exit 1
fi
