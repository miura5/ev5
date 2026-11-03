#!/usr/bin/env bash
# Probes for the rollback runbook and rehearsal 1. Usage:
#   verify.sh v5-gone <base-url> <bearer-token>   every ev4 route answers 410
#   verify.sh ev4-up  <base-url> <bearer-token>   ev4 boots, reads and writes a document
# The bearer token comes from the caller's environment (a secret), never from a file.
set -u
mode=${1:?mode}; base=${2:?base url}; token=${3:?token}
fail=0
code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -H "Authorization: Bearer $token" "$@"; }
expect() { # name want got
  if [ "$2" = "$3" ]; then echo "ok   $1 -> $3"; else echo "FAIL $1 -> $3 (wanted $2)"; fail=1; fi
}

case "$mode" in
v5-gone)
  # One probe per ev4 route in data/compat/routes.json.
  for r in "GET /api/db?since=0" "PUT /api/db/notes/rehearsal" "GET /api/run/list?collection=notes&limit=1" \
    "GET /api/run/get?collection=notes&doc_id=rehearsal" "POST /api/run/batch" "GET /api/run/collections" \
    "DELETE /api/run/x" "GET /api/run/system/manifest" "PUT /api/run/system/manifest" "POST /api/images" \
    "GET /api/images/x" "POST /api/backup/export" "GET /api/backup/newest" "GET /api/backup/get" \
    "POST /api/claude" "GET /api/claude/usage" "GET /api/claude/limits" "PUT /api/claude/limits" \
    "POST /api/jobs/rehearsal/run"; do
    expect "$r" 410 "$(code -X "${r%% *}" "$base${r#* }")"
  done
  ;;
ev4-up)
  expect "GET /api/run/collections" 200 "$(code "$base/api/run/collections")"
  expect "GET /api/db?since=0" 200 "$(code "$base/api/db?since=0")"
  # Write: put a new document, then read it back.
  coll=${REHEARSAL_COLLECTION:-ideas}; id=rehearsal-$(date +%s)
  body=${REHEARSAL_BODY:-'{"text":"rehearsal write"}'}
  expect "PUT create $coll/$id" 200 "$(code -X PUT -H 'content-type: application/json' --data "$body" "$base/api/db/$coll/$id")"
  got=$(curl -sS --max-time 20 -H "Authorization: Bearer $token" "$base/api/run/get?collection=$coll&doc_id=$id")
  echo "read back: ${got:0:200}"
  case "$got" in *rehearsal*) echo "ok   read back what was written" ;; *) echo "FAIL read back"; fail=1 ;; esac
  ;;
*) echo "unknown mode $mode"; exit 2 ;;
esac
exit $fail
