# E.V. v5 initialization plan: architect's review

Reviewed: `ev5-initialization-plan.md` (v5, revised), checked against the ev4 repo at commit `9d9af38` (read-only, shallow clone of 50 commits, so the evidence comes from code and the Chart, not from per-file git history).
Evidence was gathered by four read-only probes. Their working reports are in `/tmp/arch/{data,translate,daily,drift}/report.md`. I re-read the load-bearing claims in the code before using them here.
Tags: **[unconfirmed]** means the repo can't settle it. **[verify]** means it must be checked against current vendor docs before adoption. Every repo claim cites a path (path:line) or a Chart id.

---

## 1. Verdict

**Not sound to start as written. Sound to start after the Phase 0 edits below.** The direction is right: real modules, one job record, generated tools, standard lint, Zod. Most "import" choices are well made. But the plan's data-continuity story rests on three assumptions the repo disproves:
- ev4 cannot be made read-only.
- "Additive" doesn't protect ev4 when the data is JSON documents.
- The backups and the rollback skill cover only ev4's shape and ev4's own builds.

**Top 3 risks:**
1. **Two writers at cutover.** ev4 has no write freeze. Seven scheduled pipelines, open tabs and an offline notes outbox keep writing to live D1.
2. **Rollback that doesn't roll back.** Three gaps:
   - the rollback skill is code-only and can't target the last ev4 build;
   - a Durable Object class change blocks redeploying ev4;
   - new tables are not in any backup.
3. **A cutover scope that misses daily use.** Notes, study sessions, the study plan job and the scheduled runs are all outside it. Together with risk 1, this forces either two writers or a broken day.

**Trade-off I made throughout:** where data safety and simplicity pulled apart, data safety won. For example, I kept ev4's document table and protocol rather than a cleaner schema. Where simplicity and an attractive feature pulled apart (FTS5, the FSRS replay, the token generator), I cut the feature.

**Note on models:** you asked me to choose an appropriate model for each subagent. The agent tool in this session has no model setting, so all four probes ran on the same model as me.

---

## 2. Findings (ranked)

| ID | Severity | Section | Finding | Recommendation | Lens |
|---|---|---|---|---|---|
| F1 | **blocker** | §10 Two writers; §9 cutover | "ev4 becomes read-only before v5 writes" has no mechanism behind it. **(checked)** The app skips the READ_ONLY flag (`page/app/04-model.js:37`, `host === 'ev-app'`). The Worker accepts every write behind the token (`pwa/worker.js:39-46`). Seven scheduled pipelines write through the run API (`spec.tasks.live`; `core/runapi-client.mjs:160-167`). The notes outbox replays offline saves (`pwa/bridge.js:9-14,161-216`). §10 also contradicts §9/§10 "ev4 still serves Notes". | Make the freeze the **deploy itself**, with no change to ev4. Disable ev4's tasks (Mac ones with Matt present), take an export and a bookmark, then ship v5 over the same Worker. v5 answers ev4's routes (`/api/db*`, `/api/run/*`, `/api/jobs/*`) with an explicit 410 and a "reload" message. Preconditions: every device's outbox is empty. Fallback: v5's first boot reads ev4's IDB outbox (`ev-app`) read-only and offers to import any unsent notes. | 1, 3 |
| F2 | **blocker** | §9 After the skeleton; §10 | "Because schema changes were additive, rollback works" is unproven. **(checked)** The rollback skill is code-only (`.claude/skills/rollback/SKILL.md:14-15`). `rollbackTarget` refuses the current last live commit, so it can't target the last ev4 build once v5 isn't in ev4's `chart/deploys.json` (`tools/chart.mjs:2313-2327`). ev4 exports Durable Object class `PlanJob` with a migration (`pwa/wrangler.toml` `v1-plan-jobs`; `pwa/worker.js:27`), and B-460 (declined) records that a DO change can block a redeploy. ev4's IDB is `ev-app` v2 (`pwa/bridge.js:54,70`), and its service worker owns the same origin (`pwa/sw.js`). | Write a **v5-owned rollback runbook**: deploy the tagged last ev4 live commit through ev4's own workflow, on Matt's OK. During the rollback window v5 must: keep exporting a `PlanJob` stub class and never ship a `deleted_classes` migration; use a different IDB name; drain jobs before a rollback. On re-forward, re-derive anything v5 owns from ev4's append-only writes (attempt keys are unique, per `spec/schemas/answers.schema.json`). Gate: a full cutover → rollback → re-forward rehearsal on a throwaway Worker+D1 pair. | 3, 7 |
| F3 | **blocker** | §2 Data "same backups" | Backups copy only `docs`. **(checked)** `pwa/backup.js:64` (`SELECT c,id,data,at,v FROM docs`) and the Mac dump through the docs-only run API (`core/d1backup.mjs:33-56`). `review_log`, new columns and the existing `claude_*` tables are in no backup. Restores were only ever drilled into scratch D1s (B-424 → ev-live-scratch, `core/steps.mjs:593-637`). | Rule: **no new table goes live until the export covers it.** v5's export dumps every non-virtual table, with the `docs` section kept byte-compatible with ev4's manifest so ev4's restore drill still reads it. Add a restore drill that includes new tables, and one Time Travel restore rehearsal on staging. | 3 |
| F4 | **blocker** | §5 Grounding; §5a Search; Phase 3 | An FTS5 virtual table in live D1 endangers the export, and triggers on `docs` endanger ev4's writes. Cloudflare's docs say D1 export does not support virtual tables (see the citations in chat), and an open report says a failed export can leave the database inaccessible **[verify current status]**. **(checked)** A trigger error inside ev4's batch is reported as a false 409 "document changed" (`pwa/runapi.js:264-271`). | **Cut FTS5.** The record is about 700 documents (B-424: 703), and ev4 already loads all of it into memory (`pwa/bridge.js:1-22`). Use `LIKE` over `docs` plus passage scoring in JS in `domain/`. Prove it with a retrieval test set in `e2e`/`domain` tests (synthetic course text). If it fails that test, revisit with an FTS index in a derived, rebuildable database (see E9). | 2, 3, 4 |
| F5 | **blocker** | §2 Data "additive only" | "Additive" only holds for new **tables** and nullable **columns**. New fields inside JSON documents are not safe. **(checked)** Notes are rebuilt from an allowlist on every ev4 save (`core/notes.mjs:948-964`), so v5 fields are dropped. The schemas use `additionalProperties:false` → "unknown field" (`core/validate.mjs:148-150`). A run refuses its whole plan on one invalid merged document (`core/run.mjs:528-551`). Clients ignore a lower `v` (`pwa/bridge.js:298`). Sync depends on `at` (`pwa/worker.js:79-88`). Hashes depend on canonical JSON (B-398). | Define additive in CONTRACT as: **new tables, or nullable columns; never new fields or enum values in existing collections.** Every v5 write to an existing collection must validate against frozen copies of ev4's `spec/schemas/*.json`. A CI test enforces this, with ajv as a dev dependency **[verify]**. v5 writes bump `v`, set `at` from the Worker clock, and store canonical JSON. | 1, 3 |
| F6 | **blocker** (escalated, E1) | Phase 3 gate; Phase 4 gate; Phase 6 | "v5 staging uses a copy of the live data" conflicts with ev4's settled practice. **(checked)** B-311 (synthetic staging only); `pwa/wrangler.toml:16-18`; `tools/pwa-staging.mjs:187-225`, where any non-seed document turns staging RED and blocks `ship staging`. Staging is where agents and cold UX testers work, and its token is a repo Actions secret. Putting Matt's notes there is a decision about where his personal data goes. | Staging stays **synthetic**. Phase 3's "reads real data" check runs once, read-only, in a restricted scratch copy (the `ev-live-scratch` precedent, `pwa-live.yml:170-181`), run by the build manager with Matt's OK. It outputs counts and parse errors only, never content. | 8 |
| F7 | **high** (escalated, E4) | §2 Hard limits (D-425); §2 Product calls (delete) | Purge vs. "nothing deleted" vs. backups vs. rollback. **(checked)** Delete and purge aren't built (B-422, B-686 open). The hard-limit text still says nothing is deleted (`CLAUDE.md` Hard limits; `spec.boundaries` B-11). R2 exports are "never overwritten or deleted" (D-302), so purged data survives in every backup. ev4 has no tombstones, and its outbox re-creates a missing note (`pwa/bridge.js:687-692`). | Put soft deletes in a **new `deletions(c, id, at)` table**, which ev4 ignores, so nothing is lost on rollback. **No purge runs until the rollback window closes.** Whether a purge reaches backups is Matt's call (E4). | 1, 3 |
| F8 | **high** (escalated, E2) | §9 Phase 5; §10 Scope | The cutover scope misses daily use. **(checked)** Notes and study sessions: D-424/B-685 (Nov 1) put E.V.'s session comments at about 20 a day, and Matt filed notes reports Oct 27–Nov 1. Today's Start and Write buttons route into Notes (`page/app/10-today.js:387-400`). The study plan job: B-449…B-577, heavy use Oct 27–30. Plan tasks sit on Today (B-483, `10-today.js:69-72`). The morning 4:25 review set has no page fallback (`page/app/20-study.js:67`). Also missing: the evening runs (weak-spot parking, prep check), the Canvas Mac lane, exams and weak spots, and push notifications (B-172). | Cutover scope = Today, Library (practice, weak spots, exams), Ask E.V., **Notes with sessions**, Activity, **the study plan job**, and **the morning/evening/weekly scheduled commands**. Progress and FSRS cards wait. | 6 |
| F9 | **high** | §3.8; §5a Card scheduling; Phase 3 | There is no per-card history to replay. **(checked)** Flashcard decks were retired (D-416, Oct 31; `spec.collections.decks.retired`) and stored only a final SM-2 state (`spec/schemas/decks.schema.json`). Per-event history exists per practice item (`answers/`, append-only, right/wrong or right/partial/wrong) and per weak spot (`weakspots.events`). Scheduling today is per weak spot with fixed intervals (`core/evcore.mjs:600-780`; `spec.study.params`). | **Cut the replay and defer FSRS from the skeleton and cutover.** Port the weak-spot scheduler as it is into `domain/weakspot`. When cards return (E3), they start fresh with ts-fsrs and log every review from the first one. Keep the principle: **derived state is rebuildable from append-only logs.** | 5, 6 |
| F10 | **high** | §5 "removes… B-688"; §11.3 | B-688 is misattributed. **(checked)** The mock exam ran through `quiz_me` → `morePractice` (`page/app/20-study.js:1686`). Its "writing" state is a closure boolean (`20-study.js:1507`), and E.V.'s context lists only `S.jobs` (`page/app/72-ev-talking-with-claude.js:218-224`). B-623 has the same cause. Of 38 job bugs, 3 are queue/retry/durability, 10 visibility, 15 model output, 10 other (`/tmp/arch/drift/report.md` §1). | Add the rule **"every model call that outlives one reply is a job"**, and give E.V. a generated `job_status` tool. Justify Workflows honestly: it deletes `pwa/planjob.js`, the bridge's job section, `staleRuns` and the watchdog refire (`core/watch.mjs:219-244`). It does not fix B-688. | 1, 3 |
| F11 | **high** | §5 "One runtime, run by the Worker" | This contradicts the Canvas hard limit. **(checked)** The Canvas sync runs as a Mac-bound Claude task in Matt's signed-in tab (`spec.pipelines.evening-mac`; `scripts/canvas/dates.js:10-15`). A Worker can't do that. | **One job record and state machine, several executors.** Workflow for model jobs; Worker cron for scheduled commands; a Mac session for Canvas, which reports through a `report_job` command. | 1, 2 |
| F12 | **high** | §5 Workflows "needs you" | Parking a Workflow instance for days is fragile. Per Cloudflare's docs (see the citations in chat), `waitForEvent` defaults to 24 h and the instance fails on timeout, and the Free plan retains instance state for 3 days **[verify for waiting instances]**. A deploy or a rollback to ev4, which has no Workflow binding, during a wait is undefined **[verify]**. | **"Needs you" is a D1 state, not a waiting instance.** The instance ends at needs-you. Matt's answer starts a continuation instance whose id is derived from the job id plus a step counter (idempotent). Add this to the Phase 0 spike. | 2, 3 |
| F13 | **high** (escalated, E5) | §2 Data; §5 | ev4 runs on the Workers **Free** plan **(checked)**: `pwa/wrangler.toml:48`; `pwa/planjob.js:6-7`. On Free, per the docs cited in chat, Time Travel covers 7 days, not 30, which is shorter than any sensible rollback window, and Workflows has tighter state and subrequest limits **[verify]**. | Include the plan tier in the Workflows spike. The tier itself is a money decision for Matt. | 2, 9 |
| F14 | **high** | §2 The record; §3.5; §8 | "Only decisions still in force are restated" can't be computed from the record. **(checked)** Only 32 decisions fill `supersedes` and 34 fill `amends`, while 55 mention it in their text. D-350 ended R-03, yet the rule is still stated in `.claude/skills/rollback/SKILL.md:13` and `tools/chart.mjs:2100`. 29 superseded decisions are cited 130 times in source as reasons (e.g. D-314 in `page/app/01-kit.js:88`). ev4 already has a "no verbatim lines" check (`test/skills-drift.test.mjs`), and paraphrases got past it. | Make a **one-time sweep** of the 322 accepted decisions into CONTRACT.md in Phase 0. The in-force rules come to about 75 lines (drift report §4). Every rule gets a `§id`. Skills and READMEs may only cite `§id`s. A lint flags never/always/must/only sentences that have no `§id`. Ended ids fail the build. **No D-/B-ids as reasons in code comments.** | 4 |
| F15 | **high** | §8 "One task, one folder" | This is unrealistic for features. **(checked)** B-614 and B-619 each list 8 touch points. B-449 is cited in 26 files across 8 directories. B-609 was the "new kind in one list only" bug. | **One task = one slice.** The task names the folders it may write; context = those folders, CONTRACT, and the generated public interface of what it imports. Add the interface-change protocol (§8 of the revised plan). | 5 |
| F16 | **high** | §3.4; §5 Commands | ev4 already tried a command registry, and adoption was optional. **(checked)** `spec.actions` has 0 of the 13 chat tools (`spec.actions._rules[3]`; `core/actions.mjs`). A tool description states a false runtime fact ("saved as a Claude Doc… runs in the cloud", `72-…:400`, vs `pwa/jobs.mjs:27`). | The registry is the **only** way to define a tool, button action or schedule entry, and the build fails otherwise. Tool descriptions are generated from command metadata. A command E.V. calls that would change Matt's plan or lists runs in **propose** mode and creates a Suggestion (coach principle, enforced structurally). | 4, 10 |
| F17 | **high** | §5 Structured output; failure modes | Retries multiply and billing double-counts. The Anthropic SDK retries by default **[verify]**, and Workflow steps retry. One step that both calls Claude and writes D1 re-calls Claude when the write fails. | Inside steps, set the SDK's `maxRetries: 0`, so the step retry policy is the only retry layer. Use separate steps for the call and for the write. Record usage in D1 inside the call step, keyed by instance + step + attempt. Use strict structured outputs **[verify for the chosen Haiku model]**, check `stop_reason` (max_tokens means fail, not retry), and run Zod semantic checks, including "every cited id was in the excerpts". | 2, 9 |
| F18 | **high** | §5 Cost; §2 Models | There is no monthly ceiling or alert. **(checked)** Only hourly and daily D1 ceilings exist (`pwa/claude.js:15-66,208-257`). The usage meter promised in D-339 was never built. The Console spend limit is unconfirmed (B-310). Model ids can also be overridden by Worker vars (`pwa/claude.js:130-149`), a second source of truth. | Keep the hourly and daily ceilings and the atomic per-job ask cap (`pwa/claude.js:161-206`). Add a **monthly ceiling** computed from `models.ts` prices, with an Activity "needs you" alert and a Today line at 80%. Pre-flight reservation of max cost before each call. No env override of model ids. | 9 |
| F19 | **high** | §5a Security (missing) | **(checked)** Static assets are served before the token check (`pwa/worker.js:41`), including `spec.json` with persona and course details (`tools/build.mjs:372-410`). There's no limit on wrong-token attempts. One token serves both the app and the runs, and sits in task prompts (D-301, D-309; B-668 open). Anyone holding it can raise the ceilings (`pwa/claude.js:409-429`). | The public shell holds **no personal config**; settings come from D1 behind the token. Scoped tokens per caller (app, cloud schedule, Mac executor). Only the app token can change limits. Rate-limit wrong tokens. Keep the constant-time compare (`pwa/guard.js:18-24`). Workflow steps return ids, not content, so note text stays out of instance state (also under the 1 MiB step output limit, cited in chat). | 8 |
| F20 | medium | §5a Tokens; §4 kit/tokens | The token generator doesn't exist. **(checked)** `page/theme.js:116-123` is a literal hex table (R4) applied at runtime. `page/ds/tokens.css` (197 lines, 83 properties) is hand-written. | **Cut the generator.** Carry the values into a static `kit/tokens/tokens.css`, the single source, enforced by Stylelint. | 2 |
| F21 | medium | §5a The record | "Translate" overstates what's needed. **(checked)** About 70% of `tools/chart.mjs` (2,755 lines) is v4 ceremony (ship, trace, kickoff, brief, plan, rollback, transcript scraping), and 10 of its 11 bugs are there. The record core has had none. There are 382 decisions, D-044…D-425; D-001…D-043 live in an outside v2 doc (`DECISIONS.md:4-5`). D-361 and D-364 are superseded with no named successor. | **Carry `chart/*.json` as data.** Write a new small writer that keeps the field names and id formats (`tools/chart/record.mjs`): load/save, next id, add/update, three renders, link lint. Freeze `deploys.json` as v4 history. | 2 |
| F22 | medium | §5a Notes editor | The decision rule is already settled. **(checked)** The editor is a custom contentEditable (`page/app/25-notes.js:297,1151`). It had 6 editor bugs within 5 days of going live (B-437, B-474, B-440, B-451, B-528, B-600) and has 10 open review items (B-656, B-657). The stored format is JSON blocks (`spec/schemas/notes.schema.json`; `core/notes.mjs:6-10`), and it has had no data-loss bugs. | Keep the block format and `core/notes.mjs`'s pure model as the storage contract. **Replace the view with ProseMirror/Tiptap** through a blocks ⇄ PM adapter, round-trip tested on every stored note (synthetic in CI; a counts-only run on the scratch copy). Use `test/harness/notes.cjs` as the behaviour spec. **[verify Tiptap licence: core vs paid extensions]** | 2 |
| F23 | medium | §5a Canvas | Translate a **reduced core**: scripts 125 lines, rules 286, readers about 200, with 0 sync bugs. **(checked)** The scripts don't follow `Link` pagination past 100 items (`scripts/canvas/files.js:18`; dates.js). The `Function.toString` injection is fragile (`core/canvas.mjs:13-27`). | Port the GET scripts, `normalizeCanvas`, and the readers, bundled with no source injection. Add pagination. The orchestration (Mac session → file → unwrap) is the fragile part: give it a single job record (F11). | 2 |
| F24 | medium | §5a D1 access | There are no domain queries to translate. **(checked)** It's a generic document store with about 30 SQL statements (`pwa/worker.js:76-140`, `pwa/runapi.js`). | "Translate" here means port the **protocol**: `if_version`/409, canonical JSON, all-or-nothing batches, no delete path, and the outbox semantics (D-326 "(earlier)" copies). Write the typed wrapper new. | 2 |
| F25 | medium | §9 Phases 4 and 6 | Gate/dependency inversion. Phase 3's gate needs live data, and Phase 4's gate needs a staging Worker, but deploying staging is Phase 6. | Deploy a **walking skeleton** to a v5 staging Worker in Phase 1. Gates use synthetic staging (F6). | 7 |
| F26 | medium | §9 | The riskiest assumptions are tested late: ev4 compatibility, rollback, the editor round trip, Workflows on the current plan. | Phase 0 spikes plus a Phase 1 rehearsal gate (revised §9). Run Phases 2 (kit) and 3 (domain/data) in parallel, and risk-first. | 7 |
| F27 | medium | §3.9; Phase 6 | "Write cron in UTC and convert" still breaks across DST. ev4's own export cron is a fixed `17 8 * * *` UTC (`pwa-live.yml:122`), so it drifts by an hour. | Run the Worker cron every 15 min. A command is due when `domain/time` says its Central wall time has passed **and** no run exists for that Central date (the idempotency key). Never schedule between 01:00 and 03:00 Central. Tests on 2026-11-01 and 2027-03-14. | 2 |
| F28 | medium | §4 import rules; §5a | Internal inconsistencies: | | 1, 2 |
| | | | (1) `data` "imports only domain types", but it must parse rows with Zod. | Let `data` import domain schemas and `zod`. | |
| | | | (2) `kit` needs React and cmdk. | Allowlist React, cmdk and the chosen primitives in `kit`. | |
| | | | (3) Three either/ors are left open: Radix or Base UI, boundaries or dependency-cruiser, `@date-fns/tz` or Temporal. | **Pick one of each in Phase 0** and record it. Leaning Radix, because cmdk is believed to depend on Radix Dialog **[verify]**. | |
| | | | (4) The "command and job clients" have no home in the skeleton. | Generate `commands/client.ts`. | |
| F29 | medium | §8 shape checks | A custom script checks what types can enforce. | Use `defineJob` / `defineCommand` helpers whose types require the schemas, cost cap and callers. The script checks file presence only (story, test). Use `@playwright/test` with no custom harness: ev4's harness of 20k lines produced B-573/574/393/421/467/655. | 2, 4 |
| F30 | medium | §8 guards | The guards can be gamed: ev4 already split capped files into disguised single modules (`core/steps.mjs:388`, the `conversation.mjs` factory). | ESLint `--no-inline-config` (or `--report-unused-disable-directives` plus a count ratchet) **[verify flags]**; `@typescript-eslint/ban-ts-comment`; dependency-cruiser `no-circular`; ban `export *`; knip unused exports. | 4 |
| F31 | medium | §5a PWA; failure modes | There is no offline story, yet Notes enters scope. | Offline outbox for **append-only or version-pinned writes only** (note saves, practice answers with unique attempt keys). Everything else is online-only with a visible "not saved", as ev4 does (`pwa/bridge.js:423,515-521`). | 2 |
| F32 | medium | §10 Learning risk; §7; Phase 5 | Lens 10 mostly holds: UI rule 10 and the citations rule enforce attempt-first and grounding. Gaps: | | 10 |
| | | | (a) The one justifying metric lives in deferred Progress. | Show one retrieval-accuracy line in Library at cutover. | |
| | | | (b) Ask E.V. can explain on demand with no attempt first. | Ask E.V. prompts retrieval first and offers a logged "just tell me". | |
| | | | (c) The study plan job writes Matt's plan. | Plan Matt-first (E11). | |
| | | | (d) ev4's predictions and calibration (D-094) aren't mentioned. | Keep predictions and calibration as the metacognition hook after cutover. | |
| F33 | low | §8 READMEs | A README's "must not do" lines are a second home for rules. | Generate "must not" from the boundaries config, or cite `§id`s only. | 4 |
| F34 | low | §2 The record | "All 425+ decisions" is a count of ids: there are 382 entries, D-044…D-425. | Correct the text; locate the v2 doc (Q3). | 1 |
| F35 | low | §2 Models | `models.ts` plus a "checked on" warning is good. | Keep it. Delete the env overrides (F18). | 4 |

**Lenses that hold up, in one line each:**
- **Hono, Zod, Vitest, knip, vite-plugin-pwa and the SDK** are each justified and confined. **[verify]** Workers compatibility for the SDK.
- **Structured output plus validation, and prompt caching** are sound. ev4 already caches prompts (`pwa/bridge.js:1150`, `pwa/jobs.mjs:198-201`).
- **The UI rules are coherent.** Rule 10 is the right enforcement point for coach-not-crutch.
- **The constant-time single-user auth** is good (`pwa/guard.js`). Keep it.
- **Real modules** fully address the main drift cause: page/app is 70 fragments of one closure (`tools/build.mjs:32-48`), with state such as `S` and `morePending` shared across 5–24 files.

---

## 3. Escalate to Matt

| # | Decision | Options | My recommendation |
|---|---|---|---|
| E1 | **Staging data** (F6). The plan puts a copy of your live notes on staging, where build agents and testers work. | (a) A live copy on staging, as the plan has it. (b) Synthetic staging, as ev4 has it, plus a one-time read-only check of a restricted scratch copy that reports counts and errors, never content. (c) Synthetic only. | **(b)** |
| E2 | **Cutover scope** (F8). You write notes and run sessions daily, and ev4 can't be partly read-only. | (a) Move Notes, sessions and the study plan job into cutover. (b) Keep ev4 writable for Notes after cutover, which means two writers on one database. (c) Cut over later, all at once. | **(a)**. Progress still waits. |
| E3 | **Flashcards and FSRS.** D-416 retired decks to Quizlet. The plan adds FSRS before Quizlet goes. | (a) Defer cards and FSRS until after cutover, when cards start fresh. (b) Build FSRS cards in the skeleton. | **(a)**. There is no history to replay (F9). |
| E4 | **Purge** (F7). This challenges §2's hard limit. D-425's purge conflicts with backups that are never overwritten, and with rollback. | (a) Purge live D1 only, after the rollback window closes; backups keep everything, and the UI says so. (b) Also age purged items out of backups (a new deletion path in R2). (c) No purge during v5's first term. | **(a)** |
| E5 | **Money: the Workers plan and the Console cap** (F13, F18). Free gives 7-day Time Travel and tighter Workflows limits. B-310 is open on whether the Console spend limit is still set. | (a) Stay on Free and design around it. (b) Move to the paid plan **[verify current price]**. | Run the spike on Free. Move to Paid if the spike or the rollback window needs it. Confirm the Console limit either way. |
| E6 | **What ends the rollback window.** There's no date gate (`CLAUDE.md`, "never a date…"). | (a) Your word after one full exam on v5 with no rollback-worthy bug. (b) A fixed number of study weeks. | **(a)** |
| E7 | **Push notifications.** Today they come from the scheduled Claude tasks (B-172). | (a) A thin cloud task that only reads v5's summary endpoint and pushes; the work itself runs as Worker code. (b) Web Push, which is new code and a new key **[verify iOS PWA support]**. (c) Drop pushes. | **(a)** |
| E8 | **The public ev4 repo holds a Mac account path and the school's Canvas host** (`spec/ev.spec.json`; the repo is public per `docs/handover.md:3`). This is a hard-limit issue. | (a) An ev4 bug fix removes them from HEAD, and v5 keeps such config in D1 or Worker vars. (b) Also rewrite git history, which is a deletion and your call. | **(a)**. (b) only if you see the path as sensitive. |
| E9 | **Derived search index.** Only if F4's test fails. An FTS index in a second, rebuildable D1 holds no source data, but it touches "same D1". | (a) Allow a derived index database. (b) Never. | Decide only if it's needed. |
| E10 | **No challenge to "same Cloudflare Worker"** (§2). Keeping it actually makes the freeze atomic (F1). This is listed for visibility only. | — | Keep it, with F2's conditions. |
| E11 | **Matt-first planning** (coach principle). Today E.V. drafts whole study plans. | (a) After cutover: you rate your confidence per objective first, E.V. compares that to your accuracy and proposes, and you edit. (b) Keep the current flow. | **(a)**, after cutover, so your daily flow doesn't change during the switch. |

---

## 4. Verify list (check against current docs before adoption)

**Cloudflare Workflows:**
- the state retention per plan, and whether it applies to waiting instances;
- `waitForEvent`'s default and maximum timeout;
- the behaviour when new code deploys while an instance runs or waits;
- what happens to instances when a redeploy (ev4 rollback) removes the binding;
- the Free plan's subrequest, CPU and step limits;
- local dev support;
- step and storage billing.

**D1:**
- FTS5 export support (the late-Oct-2026 changelog);
- Time Travel window per plan, and whether ev-live has it;
- whether `d1 execute --file` is atomic;
- `migrations apply` rollback on error.

**Durable Objects:** redeploying a Worker whose class or migration set differs (B-460), and the consequences of `deleted_classes`.

**Anthropic:**
- structured outputs and strict tools support for the chosen Haiku model;
- the supported JSON Schema subset and complexity limits;
- Haiku's maximum output against the 32,000 budget;
- prompt-cache minimum length and TTL;
- the SDK's default retries and Workers compatibility.

**Libraries:**
- ts-fsrs's current API (v6 `DefaultScheduler`, the FSRS-7 default);
- Zod's JSON Schema output and its draft target;
- cmdk's Radix dependency;
- Radix vs Base UI maintenance;
- `@date-fns/tz`;
- vite-plugin-pwa service-worker takeover on an origin that already has a service worker;
- Tiptap's licence split;
- ajv drafts;
- ESLint flags (`--no-inline-config`, `--report-unused-disable-directives`);
- flat-config support in eslint-plugin-boundaries and dependency-cruiser;
- a Stylelint token plugin;
- the Playwright Docker image;
- pdf.js 4.4.168 is still served (`spec.constants.library.pdfjs`).

**Platform:** iOS PWA Web Push (only if E7(b)); a Workers rate-limiting binding.

---

## 5. Revised plan

The full revised plan, with every edit marked **[Arch: added / changed / cut]**, is in `ev5-initialization-plan.revised.md` (same folder). It keeps the original structure and section numbers.

---

## 6. Open questions

1. Are ev4's outbox entries that ev4 marks `refused` ever dropped? (`pwa/bridge.js:161-216` suggests they're kept.) If they're never dropped, the import-on-first-boot fallback in F1 is enough. **[unconfirmed]**
2. Does ev-live have Time Travel on? It has been checked only on staging (`pwa-staging.yml:224`). **[unconfirmed]**
3. Where is the v2 doc holding D-001…D-043? "History must carry over intact" needs it. **[unconfirmed]**
4. How many live `jobs` exist per kind (B-649 open)? This decides whether study-guide, clinical-prep and share-set ship at cutover or wait. **[unconfirmed]**
5. Does any live `decks/` data exist from before D-416? If so, it should be seeded into FSRS later, approximately, from the SM-2 snapshot. **[unconfirmed]**
6. Is the code citing "B-496" for the page-run timeout fix (`pwa/jobs.mjs:110-114`) a mis-cited id? tasks.json's B-496 is the decks request. This matters only for the record sweep.
7. Will v5 keep the ev-live workers.dev URL that the installed phone app opens (D-330)? If not, the phone needs re-installing, which breaks "frozen at it works".
