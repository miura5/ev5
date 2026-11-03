## Phase      4 · B-734..B-741 and B-765..B-771 done (wiring: SDK adapter, D1 stores, Worker WorkflowEntrypoint, planHome, /api/v1 job routes, ask_changes wired into the study-plan job). Gate 4 (B-742) is open: it needs a real staging run.
## Running    nothing. Stale claim branches (claude/B-7*, chart-*, handover-*) are all merged or closed and can be deleted. Builders must use their own `git worktree` and must not commit the node_modules symlink.
## Waiting on Matt   nothing.
## Next       (0) Gate 4 (B-742) is half proven. gate4-e2e.yml (workflow_dispatch, uses TOKEN_APP_STAGING) ran the practice set on staging with the real model: state done. Still to do: (a) the study plan fails at `gather: That exam was not found`, because data/staging/seed.sql has no exam doc; seed one (look at the exam repository's doc shape in data/ and the study-plan gather step), change the workflow's examId, rerun, then close B-742. (b) The practice set job reported costCents 0 although it called the model: check that cost is recorded (ceilings depend on it). (c) Check the saved set items landed (the link says library/e2e-set). (d) Phase 5 (B-743..B-752) may start now (D-461). (e) Older items: command-name handlers behind commands/; study-plan change rounds up to 5 and ceilings $1/job, $2/h, $5/day, $40/month are guesses (D-460); planHome's `plans` doc shape unverified; Chart decision for @playwright/test 1.64.1; Zod CPU check (S-64); `visual` CI job isn't required; open call: a practice set with some unsourced items returns sourced ones as set items and only unsourced as drafts (PLAN §6.4).
## Staging    ev5-staging, deploys on push to main. It was red from 14:31Z to 21:13Z (wrangler couldn't bundle `.md?raw`; prompts are now wrangler Text modules) and nobody noticed: check the staging workflow every run   ## Live  ev4 build (unchanged)

### Twenty-fourth run (2026-11-03 21:39-22:00Z)
- Merged #135 B-742 gate4-e2e.yml (finds the staging URL through the Cloudflare API, starts both jobs, polls) and #136 B-774: the SDK refused a non-streamed call at this max_tokens, so model-call.ts now uses messages.stream().finalMessage() (found by the staging run; the test fake now answers with SSE). Staging deploy is green. Lesson: workflow_dispatch needs the file on main first; render the backlog after every claim or checks fails.

### Build manager (Matt's chat), 2026-11-03 21:40Z
- Staging secrets: three random staging tokens were generated straight into GitHub secrets (TOKEN_APP_STAGING, TOKEN_SCHEDULE_STAGING, TOKEN_EXECUTOR_STAGING; nobody saw them). staging.yml copies them and ANTHROPIC_API_KEY_STAGING onto the Worker with `wrangler secret bulk` from stdin (D-310). A Gate 4 e2e job reads the same GitHub secrets.
- Fixed the staging deploy: server/job-workflow.ts imports prompt.md as a wrangler Text module (rules in wrangler.jsonc, `*.md` declared in server/cloudflare-workers.d.ts).
- Process (D-461): a gate held up only by Matt or an outside input no longer stops the build; Phase 5 starts now. Runs 18 to 23 idled for six hours because of this.

### Twenty-third run (2026-11-03 21:10-21:15Z)
- Nothing buildable: still behind Gate 4 (B-742), which needs Matt's staging secrets; no new comment from him, no open PRs. Wait branch so the chain pauses.

### Twenty-second run (2026-11-03 20:09-20:13Z)
- Nothing buildable: still behind Gate 4 (B-742), which needs Matt's staging secrets; no new comment from him, no open PRs. Wait branch so the chain pauses.

### Twenty-first run (2026-11-03 19:10-19:15Z)
- Nothing buildable: still behind Gate 4 (B-742), which needs Matt's staging secrets; no new comment from him, no open PRs. Wait branch so the chain pauses.

### Twentieth run (2026-11-03 18:10-18:15Z)
- Nothing buildable: still behind Gate 4 (B-742), which needs Matt's staging secrets; no new answer on "For Matt", no open PRs. Wait branch so the chain pauses.

### Nineteenth run (2026-11-03 17:10-17:16Z)
- Nothing buildable: still behind Gate 4 (B-742), which needs Matt's staging secrets; no new comment from him, no open PRs. Wait branch so the chain pauses.

### Eighteenth run (2026-11-03 16:08-16:15Z)
- Nothing buildable: still behind Gate 4 (B-742), which needs Matt's staging secrets; no new comment from him, no open PRs. Wait branch so the chain pauses.

### Seventeenth run (2026-11-03 15:10-15:20Z)
- Nothing buildable: every open task is behind Gate 4 (B-742), which needs Matt's staging secrets (no new comment from him). Merged #126 (Chart: B-728, B-765, B-771, B-773 marked done; they were stale 'in progress'). Branch is named wait-*, so the chain pauses until the next hourly run. If the secrets exist then: run the staging end-to-end (practice set, study plan) and close B-742.

### Sixteenth run (2026-11-03 14:58-15:09Z)
- Merged #122 B-773 (study-plan: each change round is its own workflow step `revise`..`revise_5`, so continuation ids are new; a sixth change fails in plain words). B-772 (export domain parsers/types) is declined (#123): knip rejects exports with no consumer, so export each when its first caller needs it.
- Lessons: test files obey max-lines 300; a branch that carries its own claim commit conflicts with main's squash of the Chart PR (merge main, take main's chart/tasks.json and BACKLOG.md, rerun `ops/record/cli.ts render`). The stop hook complains about the untracked node_modules in builder worktrees: never commit it. Matt had no new comment; the staging-secrets question is still open.

### Fifteenth run (2026-11-03 14:09-14:57Z)
- Merged #110 B-766 (D1 stores, migration 0002), #112 B-767 (worker.ts exports app + JobWorkflow, JOBS binding), #114 B-768 (plan-home.ts, DEFAULT_CEILINGS), #116 B-769 (server/job-routes.ts), #117 B-770 (changes.ts), #118 B-771 (revise step). tsc/eslint/depcruise/knip often can't run in the sandbox (missing vite/client, sdk types): CI is the first real check.
- Lessons: force-push is refused by the auto-mode classifier, so to fix a commit (e.g. a missing `Interface:` trailer) push a `-v2` branch and a new PR, close the old one. Builders that add a Chart task themselves get the next free id; two builders filing tasks in parallel race, so file all tasks in one PR first and let it merge before starting builders. Don't reformat files with bare prettier (no config in repo; the style is single quotes, 120 columns). A text import (`?raw`) of `jobs/*/*prompt.md` is allowed in depcruise; a module that imports its caller creates a cycle, so inject (changes.ts is passed to studyPlanHandlers by server/job-run.ts).

### Fourteenth run (2026-11-03 13:11-14:00Z)
- Merged #98 ceilings (UTC windows, amounts are config, none in PLAN/CONTRACT; prices passed in), #99 job record (JobStore compare-and-set, defineJob, startJob/continueJob/reportJob, job_status), #100 command registry (65 declarations in six *.command.ts files, catalog.ts, generated names), #101 runStructured/repair ask/checkCitations/models.ts (haiku claude-haiku-5-5, sonnet claude-sonnet-5-5, checked 2026-11-03; docs.anthropic.com is unreachable, platform.claude.com works), #102 Workflows runtime (WorkflowAdapter + in-memory fake; idempotent continuation), #103 server/auth.ts (three callers, constant-time compare, in-memory rate limit is only a soft brake), #104 practice set job, #105 study plan job.
- Open call for Matt-free decision: a practice set with some unsourced items returns sourced items as set items and only unsourced ones as drafts (PLAN §6.4 may mean the whole set goes through drafts). Revisit when the save step is written.
- Lessons: parallel builders in one checkout clobber each other (claims landed on the wrong branch); always `git worktree add`. Five parallel PRs all conflict on docs/record/BACKLOG.md: take main's and rerun `node ops/record/cli.ts render` + `node ops/generate/cli.ts`; land them one at a time. `gh` GraphQL is blocked: use MCP/REST (auto-merge: PUT /repos/miura5/ev5/pulls/N/ccr/auto_merge). The auto-mode classifier refuses `git clean`/force checkout in the shared checkout.

### Thirteenth run (2026-11-03 11:06-12:10Z)
- Merged: B-728 parsers for exams, notes, objectives, sessions, sets, weak spots (#92); B-711 ⌘K palette, last first-set component (#93); B-712 visual baselines (#94, #95) generated by dispatching visual-baselines.yml on a branch (needs the Docker image, so not possible in the sandbox). Chart rows for B-710..B-713, B-724, B-729, B-730 recorded.
- Lessons: a commit that touches an index.ts needs an `Interface: <folder>` trailer or checks fails; a bot push (the baselines workflow) doesn't trigger CI, so push one real commit after it.
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
