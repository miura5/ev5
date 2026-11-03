## Phase      1 (Gate 1 waits only on B-708 rehearsal sign-off); Phase 3 entities nearly done (B-714…B-727, B-729, B-731 merged)
## Running    Another build run was active in parallel at the end of this one: open PRs #72 (B-728 D1 docs repository), #73 (B-724 domain/pin), #68 (B-711 kit first set). Check `git ls-remote origin 'refs/heads/claude/B-*'` and open PRs before claiming.
## Waiting on Matt   nothing.
## Next       1) Land #72/#73/#68 (owned by the other run), then record B-724, B-728 (first slice), B-711 in the Chart. 2) B-708/Gate 1: rehearsal.yml was dispatched once on ev4 9d9af38 and the run was green; dispatch `cleanup` ran too, so check it deleted ev5-rehearsal (Worker + D1), then record B-708 done and Gate 1 (B-709). 3) Entities left: B-730 export (S-51), B-732 scratch-copy check (S-53, OK given D-453). 4) `domain/index.ts` barrel so `data` can import parsers (depcruise only-through-index allows one level); wire exam/objective/weak-spot/set/item/session/note/course into the docs registry. 5) Add `data/docs/` to the `npm test` script (branch claude/test-data-docs has it; open once data/docs is on main). 6) B-712 gallery shows tokens only; stories for kit components and Playwright baselines remain (S-39). 7) Stylelint's "ease" regex rejects `var(--ease)`; fix it. 8) Then Phase 4 once Gates 2/3 are done.
## Staging    ev5-staging Worker, deployed on every push to main · main c30dd14+   ## Live  ev4 build (unchanged)

### Ninth run (2026-11-03, ~08:44-09:50Z)
- Merged: B-710 tokens (#45, kit/tokens/tokens.css), B-708 rehearsal workflow (#47), B-716 objective (#54), B-717 weak-spot (#49), B-718 set (#51), B-719 item (#55, built by the other run), B-720 session (#56), B-721 note (#60), B-722 course (#52), B-723 collection (#57), B-725 item-props (#63), B-726 own-set (#65), B-727 draft (#64), B-731 search (#58), B-712 /kit gallery first slice (#70). Chart recorded for B-725..B-727 (#69).
- B-728 (#71) was closed by the other run in favour of #72. B-712 stays open in the Chart (first slice only).
- Rehearsal 1 ran green on the throwaway ev5-rehearsal Worker. Step 3 (v5 answers 410) was expected to fail until the Worker returned 410; verify in the run log before calling Gate 1.
- Lessons: (1) The interface-trailer check wants `Interface: domain/<x>` in the body of every commit that touches a domain index.ts: use ONE commit per PR. (2) Force-push is denied in this environment; when a PR goes conflicting on chart/ or docs/record, rebuild it on a new branch `-v2` and close the old PR. (3) Builders must not touch chart/ or docs/record; the build manager records done tasks in one small Chart PR after the merges, which avoids the conflicts. (4) knip fails on unused exports: export only what is used. (5) Two build runs overlapped this hour and duplicated B-724/B-725/B-728: always run `git ls-remote origin 'refs/heads/claude/B-*'` right before pushing a claim and again before opening a PR.
- Domain notes from builders: set/session/note/item leave prompt builders, wrap-up parsers and numeric/open grading for the job tasks; collection needs `courseAt` from the data layer (S-49); item-props `overrides` accepts any flat scalar object until the commands task defines its fields; draft `kind` names and write shapes are provisional; `MAX.documentBytes` (262144) is hard-coded in domain/note/types.ts.

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
