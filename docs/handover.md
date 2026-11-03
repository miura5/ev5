## Phase      2/3 in parallel · Gate 1 passed (B-709 done): rehearsal 1 green, actions run 41616883069 (ev4 9d9af38 deployed on throwaway ev5-rehearsal, v5 answered 410 on ev4 routes, ev4 redeployed, read/wrote, PlanJob binding intact). Cleanup was dispatched; confirm ev5-rehearsal is gone.
## Running    other runs hold claude/B-710-tokens (PR #77), B-711-kit-part2, B-730-export, B-716..B-728 stale branches (several merged: delete them)
## Waiting on Matt   nothing
## Next       Phase 2: B-710 tokens (#77), B-711 further kit components, then Gate 2 (B-713). Phase 3: B-730 export, B-732 scratch-copy check (counts only, D-453), then Gate 3 (B-733); Chart rows for merged B-710..B-731 may lag main: check `git log` against tasks.json first. Then Phase 4 (B-734..).
## Staging    ev5-staging, deploys on push to main   ## Live  ev4 build (unchanged)

### Tenth run (2026-11-03 10:08Z)
- Ran rehearsal 1 (rehearsal.yml worked as is, no changes needed) and recorded B-708/B-709 done (#80). Little was unclaimed: concurrent runs hold the other branches. Handover PRs #74 and #76 are superseded.

### Build manager (Matt's chat), 2026-11-03 08:50Z
- Runs were ending after one small task (~3 minutes each), and the chain broke because handover PRs were opened before the task PR merged, went BEHIND and never merged (#41, #43, closed). START-BUILD item 4a: keep claiming batches for about 50 minutes; item 7: open the handover only after this run's PRs merge, cut from latest main. AGENTS §3 step 10 matches.
- Rehearsal question withdrawn: ev4 is public, and the routine now checks out miura5/ev4 read-only.
- B-714 (#40) and B-715 (#42, domain/exam) recorded done. B-715 validates by hand (zod has no Chart decision yet) and didn't port ev4's tests: the next entity run can add them from ../ev4.

### Eighth run (2026-11-03)
- B-714 (S-40, #38, auto-merge on): domain/time uses Intl only (no @date-fns/tz: a new dependency needs a Chart decision). Done: Central date/time, centralToInstant, isDue, isOverdue/daysUntil, repeat rules, DST tests for 2026-11-01 and 2027-03-14. Matt still hasn't answered the rehearsal question. Superseded: handover PR #37 can be closed.
- npm ci works in the sandbox on Node 22 with --ignore-scripts --engine-strict=false.

### Seventh run (2026-11-03)
- B-764 (#34, auto-merge on): server/ev4-routes.ts answers every route in routes.json with 410; unknown /api paths stay 404. Tests run via `server/*.test.ts` in npm test (tsc excludes them). Matt has still not answered the rehearsal question.

### Sixth run (2026-11-03)
- B-709 (#32): the guard tests failed on every PR run (GITHUB_BASE_REF leaked into the temp repo); fixed and merged. #31's handover was red for that reason; this branch supersedes it. Matt has not answered the rehearsal question yet.

### Fifth run (2026-11-03)
- B-706 (#28): staging.yml deploys on push to main; live.yml is dispatch-only in the `live` environment (never triggered); ops/checks/account.ts fails any config/workflow naming ev-live except live.yml. spike.yml and spike/ removed.
- B-705 (#30): ops/guards/guards.test.ts makes all 9 guards red in temp repos; docs/guards.md records the output. Now part of `npm test`.
- B-708 (#29): ops/ROLLBACK.md, ops/rollback/verify.sh, dispatch-only rehearsal.yml (throwaway ev5-rehearsal Worker+D1; has a cleanup action). Not run. ev4 file paths in it (pwa/wrangler.toml, pwa/schema.sql) are guesses; PlanJob state, ev4's IndexedDB and ev4's synthetic record aren't covered by it. v5 returns 404, not 410, for ev4 routes, and has no PlanJob binding (the rehearsal stubs one).
- Merging a PR makes the others need "update branch"; the Chart/BACKLOG conflict on parallel claims: take main's files and rerun `task claim`. knip reads names in workflow shell as binaries: add to `ignoreBinaries`.
- The sandbox has Node 22: run tests by glob with --experimental-strip-types. node_modules may be absent in worktrees.

### Earlier runs (2026-11-03)
- B-704 (S-13): `ops/generate` writes areas/registry.generated.ts, commands/client.ts and README blocks; after adding an index.ts/schema/command file run `node ops/generate/cli.ts`. shell/main.tsx doesn't use the area registry yet (area.ts has no component; needs a design call).
- B-707 (S-16): Hono Worker server/index.ts, wrangler.jsonc, data/staging. Only the `docs` table is in the staging schema; add ev4's other five from the real schema.sql. The stale `claude/spike-s-08-editor` branch can be deleted.
- B-702/B-703: ESLint, dependency-cruiser, Stylelint, knip, ops/checks. TypeScript 7 has no JS compiler API: Babel parses for ESLint, @swc/core for dependency-cruiser (D-456). Loose ends: knip ignores the unused export `ids` in ops/record/chart.ts; Stylelint token rules haven't run on real CSS (S-20 may tune); README cap 20 lines, SKILL.md 200.
- B-701 (S-10) base; S-07 Workflows passes on the Free plan (docs/spikes/S-07-workflows.md); follow-ups: Zod CPU check in S-64, mid-sleep instance under a binding-removing redeploy in S-17.
- The cloud session cannot reach developers.cloudflare.com; GitHub GraphQL is blocked (use REST/MCP). The staging token has no KV scope: delete Workers through the API.
- `task claim` refuses a task already "in progress"; a stale claim needs `task set --notes`.

### Notes for the next run
- Matt's answers ahead of time: hourly runs (D-452); S-53 scratch-copy OK given (D-453); Canvas sync stays on the Mac (D-454), S-81 needs him present.
- `main` is protected: PR from a `claude/` branch, `checks` green, up to date, auto-merge squash. Claim by pushing `claude/<id>-…`.
- Record commits after the squash merge: the squash hash differs.
- Hard limits are CONTRACT §1 (five). The Chart holds decisions D-426…D-456 and seed tasks B-691…B-763 (docs/record/).
