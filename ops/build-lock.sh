#!/usr/bin/env bash
# One build run at a time (AGENTS.md §3 step 0). The lock is the branch claude/build-lock on origin.
# Its newest commit message says "held by <run> <time>" or "released by <run> <time>".
# Taking or renewing pushes a child commit without force, so two runs that race cannot both win:
# the second push is not a fast-forward and GitHub rejects it.
#
#   ops/build-lock.sh take      exit 0: this run holds the lock; exit 3: another run is working, end this run
#   ops/build-lock.sh renew     after each merged batch, so a long run does not look stale
#   ops/build-lock.sh release   before opening the handover or wait PR
#   ops/build-lock.sh status    print the holder and the age
#
# A "held" lock older than 75 minutes is stale (its run died) and may be taken.
set -u
REF=refs/heads/claude/build-lock
LOCAL=refs/remotes/origin/build-lock
STALE=4500
ME="${CLAUDE_CODE_REMOTE_SESSION_ID:-${BUILD_RUN_ID:-}}"

if [ -z "$ME" ]; then
  echo "LOCK: no run id (set BUILD_RUN_ID)" >&2
  exit 2
fi

git fetch -q origin "+$REF:$LOCAL" || { echo "LOCK: cannot read $REF" >&2; exit 2; }
TIP=$(git rev-parse "$LOCAL")
SUBJ=$(git log -1 --format=%s "$TIP")
AGE=$(( $(date +%s) - $(git log -1 --format=%ct "$TIP") ))

move() { # $1 = new message; pushes a child of TIP
  local new
  new=$(git commit-tree "$TIP^{tree}" -p "$TIP" -m "$1 $(date -u +%FT%TZ)") || return 1
  git push -q origin "$new:$REF" 2>/dev/null
}

case "${1:-status}" in
  status)
    echo "LOCK: $SUBJ ($((AGE / 60)) min ago)"
    ;;
  take)
    case "$SUBJ" in
      "held by $ME "*) ;;
      held*)
        if [ "$AGE" -lt "$STALE" ]; then
          echo "LOCK BUSY: $SUBJ ($((AGE / 60)) min ago). Another run is working: end this run without a handover."
          exit 3
        fi
        echo "LOCK: taking a stale lock ($SUBJ, $((AGE / 60)) min ago)"
        ;;
    esac
    if move "held by $ME"; then echo "LOCK TAKEN by $ME"; else echo "LOCK BUSY: another run took it first. End this run."; exit 3; fi
    ;;
  renew)
    case "$SUBJ" in
      "held by $ME "*) move "held by $ME" && echo "LOCK RENEWED" || { echo "LOCK: renew failed" >&2; exit 2; } ;;
      *) echo "LOCK: not held by this run ($SUBJ). Stop starting work and end the run." >&2; exit 3 ;;
    esac
    ;;
  release)
    case "$SUBJ" in
      "held by $ME "*) move "released by $ME" && echo "LOCK RELEASED" || { echo "LOCK: release failed" >&2; exit 2; } ;;
      *) echo "LOCK: not held by this run ($SUBJ); nothing to release" ;;
    esac
    ;;
  *)
    echo "usage: ops/build-lock.sh take|renew|release|status" >&2
    exit 2
    ;;
esac
