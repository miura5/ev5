# ev4 context drift and job runtimes: evidence for the v5 plan review

Scope: /workspace/ev4 at 9d9af38 (Nov 2). The clone is shallow (50 commits, one grafted root commit holds the whole tree), so `git log` can't show per-file history. Everything below comes from reading the code and the record.
Tags: **[checked]** = I read it in code or the record. **[inferred]** = my reasoning. **[unconfirmed]** = not provable from the repo. **[verify]** = depends on current vendor docs.
Scratch files: `/tmp/arch/drift/jobbugs.txt` (the keyword-matched bugs) and `/tmp/arch/drift/dcites.txt` (how often source code cites each D-id).

---

## 1. Job runtimes, and the claim that Workflows removes the source of B-688

**Verdict: the claim is wrong in its specifics. The plan's direction is right.**
- B-688 has nothing to do with queue or retry code. It comes from a job path the Diagnosis doesn't count: an in-tab model call whose "writing" state is a closure boolean, which E.V.'s chat context never sees.
- Of 38 job-related bugs, 3 come from queue, retry or durability. Workflows would remove some real custom durability code, but it would have prevented few of the recorded bugs.
- What would have prevented B-688 and B-623 is "every model call that outlives a reply writes a job record, and E.V. has a tool that reads job status". The plan's "one job record + Activity + tools generated from the registry" covers that, as long as quick generation counts as a job.

### The runtimes [checked]

| # | Runtime | Started by | State lives in | Retries / timeouts | How the page and E.V. learn state |
|---|---|---|---|---|---|
| R1 | **In-tab job** (app): `pwa/bridge.js:773-860` `runAppJob` runs `pwa/jobs.mjs:569 runJob` in the browser | The page writes `jobs/<id>` and calls `fire()` through MCP (`page/app/62-ev-jobs-and-filing.js:96`). The app has no MCP, so `fired.error='mcp_unavailable'` is written. The bridge intercepts that write, rewrites it as `fired.ok:true` (`bridge.js:752-758 jobHandOff`) and runs the job. | `jobresults/<id>` in D1 (`statusWrite`, `jobs.mjs:336`), plus `running` (an in-memory Set) | Each ask is aborted after `askTimeoutMs` (≥150 s, `jobs.mjs:112`). The run window `PAGE_RUN_MS` is 12 min (`:114`). Conflicts re-fold up to 8× (`CONFLICT_TRIES`, `:29,589-602`). The next boot marks a `running` result older than 20 min as failed (`staleRuns`, `:671-678`; `bridge.js:922`). Closing the tab kills the run. | Page: `S.jobs` built from `jobs` + `jobresults` (`03-connect.js:186`). E.V.: a "Recent jobs" line listing the 5 newest (`72-ev-talking-with-claude.js:218-224`) and `show_card type:job`. No lookup for jobs. |
| R2 | **PlanJob Durable Object** (exam-plan only): `pwa/planjob.js` | The page calls `POST /api/jobs/<id>/run` up to 3 times (`bridge.js:865-901`). The Worker answers 202. The DO's alarm then runs the same `runJob` against D1. | `jobresults/<id>` in D1, plus the DO's own `storage.run` (`planjob.js:248-282`) | `PLAN_DEADLINE_MS` is 14 min, under the alarm's 15-min wall limit. `PLAN_START_MS` is 90 s. One run per job. A run cut mid-way is marked failed (`planjob.js:1-15,20-27`). | The page polls every 3 s (`watchJob`, `bridge.js:903-919`). E.V. learns it the same way as R1. |
| R3 | **Cloud worker pipeline** (Claude Code session, claude.ai staging preview): `core/run.mjs` start/pull/compute/apply/end | `fire_trigger` on `spec.tasks.*.worker` ("Job <id>") | `runs/<id>` + `jobresults/<id>`. The run's working files are in the session's `/tmp/ev` (`run.mjs:1-11`). | The watchdog re-fires a job "queued too long" after `jobStallMinutes` 15 (`core/watch.mjs:219-244`, `spec.constants.watchdog`). A batch refused on its version pin is re-pulled and re-planned. | `jobresults` |
| R4 | **In-chat question writing, no job record**: `morePractice` (`page/app/20-study.js:1686-1880`), `moreDosage`, called by the `quiz_me` and `make_practice` tools, More practice, quick asks, cards | Called directly and not awaited (`20-study.js:831`) | **`let morePending` (20-study.js:1507)** and the DOM text of `#more-status`. The record changes only at the end: `sets/more-<date>-<k>` plus one talk message, or just a message if it fails. | None. A reload loses it. | **E.V. can't see it.** It is not in `S.jobs`, and no tool reads `morePending`. |
| R5 | **Builder jobs** (`spec.jobs.builderKinds`: build, reply, design, plan, ship) | `ACT.tap('build-ask')` + `fire(TASKS.builder)` (`62-…:127-156`) starts an ev4-builder Claude session | `jobs/<id>`, `jobresults` (the `trace` row) | The watchdog re-fires after `builderStallMinutes` 90 (`watch.mjs:221-238`) | Job card |
| R6 | **Scheduled pipelines** (morning, evening-cloud, weekly, watchdog: cloud Claude sessions; evening-mac, restore-drill: **Mac sessions with Matt's signed-in browser**) | `spec.tasks.live` cron (`CRON_TZ=America/Chicago …`). A prompt rendered by `tools/prompts.mjs` carries `tools/gate.mjs` as a `node -e` one-liner. | `runs/<id>`, `health/current` | The watchdog refires missed or unfinished runs (`runTimeoutMinutes` 60) | System and health views |
| — | `pwa/job-stub.mjs` is a test stand-in for Claude (plants: PLANT-SHAPE/PLAN/LOW/ASK), not a runtime. The Worker cron `pwa/backup.js` is a seventh scheduled thing. | | | | |

Notes on the table:
- The Diagnosis canvas (`docs/design/ev5/canvas/project/Diagnosis.dc.html:22`) says "3 runtimes: Page to Worker, cloud tasks, Mac tasks". It lumps R1 and R2 together and misses R4, the runtime B-688 actually comes from. **[checked]**
- **Hazard [inferred, unconfirmed in production]:** app jobs carry `fired.ok:true` (they are rewritten by `jobHandOff`). `watch.mjs:225` selects stalled jobs by `fired.ok` and doesn't check `source`. `job-brief` doesn't skip a job whose result is `running` (`core/steps-worker.mjs:30-34`). So a tab-killed app job left `running` for more than 15 min could be refired to the cloud worker before the app's 20-min `staleRuns` sweep runs. That is a cross-runtime double run. D-308 says the worker "no longer serves the app", but `spec.tasks.live.worker` still exists.
- **Mac lane [checked]:** `spec.pipelines.evening-mac` reads Canvas "through his signed-in browser tab" (CLAUDE.md Hard limits: never a token). A Worker or Workflow can't run that. "One runtime, run by the Worker" (Layers.dc.html:37) needs an external executor that reports into the same job record.

### Job-related bugs (kind=bug, 38 after removing keyword false positives), classified

- **Q, queue/retry/durability (3):**
  - B-459: a plan request held open dies when the phone backgrounds. Fixed by R2.
  - B-397: the run API client retried timed-out batches, so a write that landed was reported as refused.
  - B-582: Remake could be tapped while its job was being written (dedupe). Partly Q.
  - Also: the timeout fix "a page run always ends" is cited in code as B-496 (`jobs.mjs:110-114`, `bridge.js:784`), but B-496 in tasks.json is the flashcard-deck request. The fix never got its own bug, and the code cites the wrong id. **[checked]**
- **V, state visibility to E.V. or the UI, or several homes (10):**
  - B-688: mock-exam status unknown (R4).
  - B-623: E.V. said questions were being written when none had started (R4 again).
  - B-263: E.V. couldn't read a finished plan job's details.
  - B-194: the plan card opened Study with no plan.
  - B-479: flashcard job output visible nowhere.
  - B-599: deck not listed.
  - B-521: long job showed no working state, and a failed one was reported as "ready".
  - B-538: deck card shows no Working line.
  - B-471: claude.ai view told him the job needs a connector.
  - B-468: brief reads the frozen ArtifactData `health/current` instead of D1's.
- **M, prompt, routing or model output (15):**
  - B-491: `/plan: expected object, got string`. Structured output fixes this [verify].
  - B-481: wrong dosage key.
  - B-480 and B-484: set came back short after checks dropped items.
  - B-476: "Not applicable".
  - B-485: flashcards sent as a general job, then failed at 1,500 chars.
  - B-493: `verify:true` text left in a card.
  - B-495: flashcard asks recognised too eagerly.
  - B-456 and B-461: plan edit routed to a new plan, or to the list.
  - B-463: wrong weekday.
  - B-669: refused, citing earlier failed jobs.
  - B-679: CJ steps on a biology course.
  - B-498: cross-course items.
  - B-536: drug-card routing, empty enum.
- **O, other (10):**
  - B-609: **runtime parity**. `pwa/jobs.mjs` never called `EV.configure`, so app jobs lost NCLEX framing (now `jobs.mjs:85`).
  - B-169: release regex vs the `+n` build name.
  - B-462: finish stamped with the start time.
  - B-470: thinking-block replay 400 in the hand-written multi-turn loop (`jobs.mjs:405-408`).
  - B-457: billing and ceiling accounting on a dropped Sonnet ask (open).
  - B-460: DO migration breaks rollback.
  - B-110: a run's 50-deep clone misses the deployed commit.
  - B-167: hooks loaded into the watchdog session refused it, and health went 37 h stale.
  - B-187: builder session never got its fired text.
  - B-172: gate-failure push had no text.

**Counts:** Q 3 · V 10 · M 15 · O 10.
- Workflows plausibly prevents B-459 (already fixed) and part of B-582 [inferred].
- One job record + registry-generated tools prevents most of V, plus B-609.
- Structured output and code routing ("chosen by code, not by the chat model", B-485 DoD) cover much of M.
- About 5 of the O bugs (B-110, B-167, B-169, B-172, B-187) belong to the **Claude-session-as-runtime** design (R3/R6). They go away only if scheduled runs stop being repo-cloning Claude sessions.

The custom durability code that does exist, and that Workflows would replace:
- `planjob.js` (285 lines)
- the bridge job section (~200 lines)
- `staleRuns`, `watchJob`, the `startWorkerJob` retry loop
- the watchdog job refire (`watch.mjs:219-244`)

The re-fold on version conflict (`CONFLICT_TRIES`), the fix ask and top-up (`jobs.mjs:430-560`) and ceiling accounting are application logic. They stay under Workflows. Step wall-time, CPU and Free-plan limits for multi-minute Claude calls: [verify].

---

## 2. Drift causes: evidence

### (a) Global-scope page scripts [checked]
- `tools/build.mjs:32-48 appSource` lists `page/app/*.js`, sorts the names and joins them with `''`. The comment there says: "Each part is one section of the one closure EVApp.boot runs… only the joined file is JavaScript on its own."
- These are 70 files, 21,788 lines. `00-boot.js` has brace balance +2 and `91-forms.js` has −2: the files are **fragments of one function body**, not even scripts.
- `tools/format-app.mjs:2` exists only because prettier can't format the parts separately.
- 1,070 top-level closure names; 380 of them are used in a file other than the one that defines them (my scan, rough).
- Examples:
  - `S` (record state, `03-connect.js:25`): 24 files
  - `T` (chat state, `60-ev-conversation.js:15`): 19 files
  - `M` (`04-model.js:2`): ~16 files
  - `write` (`04-model.js`): 20 files
  - `render` (`03-connect.js`): 21 files
  - `startJob` and `fireCopy` (`62-…`): 7 files
  - `evSay`: 9 files
  - **`morePending` (`20-study.js:1507`) is read in `10-today.js:355`, `67-ev-cards.js:692`, `70-ev-quick-asks.js:86`, `72-…:979`**. This is the very state B-688 needed.
- Ordering: 141 names are used in a file that sorts *before* the file defining them (e.g. `ui` from `02-navigation.js` used in `01-kit.js`; `render` from `03-connect.js` used in `01-ui.js`). That works only because the uses run later, inside callbacks. A top-level call would hit the TDZ.
- Import-direction tools see **zero edges** in `page/`, because nothing is imported.

### (b) The same rule stated in several places, contradicting [checked]
1. **R-03 (no live deploy during a study session)** was ended by D-350 (Oct 27; `chart/rules.json` R-03 `ended`; `tools/chart.mjs:1196-1199` "R-01, R-03 and R-05 are ended"). It is still stated as in force in three places:
   - `.claude/skills/rollback/SKILL.md:13-14`: "R-03 … still applies"
   - `tools/chart.mjs:2100` (`runWindows`, printed into the brief): "A live deploy waits while a study session runs (R-03)"
   - D-178 (accepted): "R-03 … stay[s]"
   D-350 records no `amends` of D-178.
2. **Job routing:**
   - `spec.jobs._rules[0]`: "The page writes jobs/<id> and fires the worker…; the worker writes jobresults"
   - D-308: the app runs every job through the API, and the worker no longer serves the app
   - `pwa/bridge.js:18-22`: how it actually works
   - the `start_job` tool description sent to the model (`72-…:400`): "study-guide: …saved as a Claude Doc… Runs in the cloud"
   - `pwa/jobs.mjs:11-12,27-28`: the app saves the guide in E.V., "not as a Claude Doc"
   E.V.'s own tool description contradicts its runtime.
3. **Nothing is deleted** is stated four ways with three scopes:
   - `spec.workingAgreements[1]`: absolute
   - `spec.boundaries` B-11: Mac only
   - `CLAUDE.md:54-57`: everywhere except repo code and D-419's one-off
   - `rollback/SKILL.md:14`
4. **Full suite once per batch** is pinned by `test/skills-drift.test.mjs:71-76` to ev-build-manager's exact wording. It is restated in paraphrase at `CLAUDE.md:45-46`, `ev-builder/SKILL.md:53-54` and `tools/check.mjs:9-11`. The pin's regex misses paraphrases.
5. **Stale spec text:**
   - `spec.boundaries._rules[0]` says "CLAUDE.md names every id here", while the test enforcing it asserts the opposite (`test/spec.test.mjs:372`: "B-665: no B-xx list").
   - `spec.workingAgreements[2]` still refers to the "v3 doc Decisions tab" and a "Board row", though v3 is retired (CLAUDE.md:14).

### (c) E.V.'s tools vs buttons vs spec.actions [checked]
- `spec.actions` was ev4's version of "one list of commands" (D-203, B-186, Oct 21; `core/actions.mjs`, 387 lines). Its own `_rules[3]` says: "The 13 conversation tools become rows one at a time, when a task touches them."
- Today it has 16 rows: 7 builder or page-plumbing rows (build-ask, reply, design-ask, plan-ask, ship-it, job-fired, chat-close), trace, ship-live, and 7 weakspot rows. **None of the 13 chat tools** (`72-…:350-1050`: show_card, start_job, record_score, add_weakspot, edit_dates, tick_item, edit_list, lookup, materials, save_idea, make_practice, quiz_me, study_session) is a row.
- `test/data/actions-legacy.json` still lists 32 page write sites "as of Oct 21" that "only shrinks". It is enforced by a hand-written JS tokenizer (`test/actions.test.mjs:250-300 codeOnly`).
- Buttons and tools call the same closure functions (`startJob`, `morePractice`), but routing differs:
  - B-485: a chat request became a general job. The fix was "chosen by code, not by the chat model".
  - B-461: the Ask for changes button vs the chat.
  - B-651: the show_card description still listed the retired `checkin`.
  - `lookup` has no `jobs` option. That is the B-688 gap.

### (d) Superseded or retired rules that agents still obeyed [checked]
- **D-411 (Oct 30), "Current direction beats older rules":** its why says older tenets "scattered through the codebase are often stale". Example given: B-361's "graded badges never red".
- Sweep tasks (11 mention "sweep"): B-141, B-142, B-217, B-225, B-275, B-276, B-282, B-303, B-611, B-664, B-665. **B-620 is open:** 9 tenets still to recheck (D-124, D-126, D-129, D-327, D-243, D-200, D-201, D-185, D-190).
- Source code (not tests) cites **29 superseded decisions 130 times**. Example: D-314 ("the demo wins…", superseded by D-316) is still the stated reason in `01-kit.js:88`, `10-today.js:648`, `67-…:848`, `70-…:107`, `74-…:52`.
- Code comments cite 1,520 D-ids and 2,532 B-ids in total. Decisions act as in-code instructions.
- The skills-drift check passes on R-03 because it checks only that the D-ids skills cite aren't `superseded` (`skills-drift.test.mjs:57-66`). It ignores R-ids, `ended` flags and amendments nobody recorded.

### (e) Custom checks that drifted or caused bugs [checked]
There is no ESLint, Stylelint, TypeScript or knip (`package.json` devDeps: only playwright and prettier).

| Custom piece | Drift / bug | Standard replacement |
|---|---|---|
| `tools/hooks.mjs` (437 lines; stop/spec-format/live-guard/md-guard) | B-167: the hooks loaded into the live watchdog session and refused it, so health went 37 h stale | Claude Code hooks stay custom. Live-guard duplicates GitHub environment approval, which CLAUDE.md says "holds either way". |
| `tools/gate.mjs` (rendered into a prompt as `node -e`, "no comments, no double quotes") | B-110, B-168 (clone depth) | Goes away if runs are Worker code, not repo-cloning sessions |
| `tools/d307.mjs` regex lint of ArtifactData+run API | B-468, a stale ArtifactData read, got past it | dependency-cruiser forbidden-import rule. Moot in v5 (one store). |
| `test/actions.test.mjs` tokenizer + legacy counts | Stalled since Oct 21 | ESLint `no-restricted-imports` / boundaries: areas can't import data/ |
| `test/harness/*.cjs` (20,469 lines; own `check()` runner on the playwright library; `quarantine.json` for flaky checks) | B-573, B-574 (smoke plant stopped firing, red for 25+ commits), B-393, B-421, B-467, B-655 | `@playwright/test` (retries, projects, traces) [verify] |
| `tools/check.mjs` `--touched` harness map | "a path it does not know runs them all" | CI matrix + Playwright tags |
| `tools/hover-gate.mjs` (build-time CSS rewrite), `tools/token-audit.mjs` | — | Stylelint rules / postcss [verify] |
| `test/build.test.mjs:347` evcore 2,500-line cap | Gamed in spirit, see §3 | ESLint `max-lines` (same weakness) |
| B-609 / B-614 enum lists (schema vs `LIST_KINDS` vs `DS.kind` vs pickers) | the Learn-can't-save bug | TS unions / zod generated from one source |

`test/skills-drift.test.mjs` has no off-the-shelf replacement and is worth keeping.

### (f) File sizes [checked] (lines; prettier at 120 columns)
- Source files over 300 lines:
  - page/app: 19 of 70 (84% of its lines)
  - core: 19 of 40 (84%)
  - tools: 8
  - pwa: 5
  - page/ds: 2
  - page shell: 1
  - **54 files in all**
- Largest:
  - `tools/chart.mjs` 2,755
  - `core/evcore.mjs` 2,474
  - `page/app/25-notes.js` 2,078
  - `10-today.js` 1,946
  - `20-study.js` 1,913
  - `64-ev-study-sessions.js` 1,540
  - `72-ev-talking-with-claude.js` 1,283
  - `pwa/bridge.js` 1,278
  - `core/sessions.mjs` 1,204
  - `21-study-plan.js` 1,198
  - `core/steps.mjs` 1,137
- Tests: 34,748 lines plus a 20,469-line harness. `test/harness/run.cjs` alone is 6,778 lines.

---

## 3. Does the v5 skeleton address these causes?

- **Real modules, one feature per folder:** addresses (a) fully, and it is the precondition for boundary tooling.
- **One job record + Activity + generated tools:** addresses B-688 and B-623 **only if** R4-style "write questions now" calls are jobs too. The plan must say that **every model call that outlives one reply is a job** and that **E.V. gets a job-status tool**.
- **Mac/browser executors:** missed. Keep one job record and state machine, with several executors (Worker/Workflow, Mac session) that report into it. Waiting on an external report: [verify].
- **CONTRACT.md + "no verbatim lines" check:** ev4 already has that check (`skills-drift.test.mjs` PINNED) and paraphrases got past it (2b-4), as did R-03 (2b-1). To close the gap:
  - rules carry ids (`§id`)
  - skills may cite only ids
  - lint any skill or README sentence containing never/always/must/only that lacks a `§id`
  - ended or superseded ids fail
  - tool descriptions for E.V. are generated, and none states a runtime fact by hand
- **"Only decisions in force restated":**
  - The rules themselves are small: 20 accepted tenets + 16 active boundaries + 2 active ship rules + 5 working agreements ≈ 7.9k chars ≈ 75 lines.
  - The risk is the other ~300 accepted product decisions that code comments cite as reasons (1,520 citations).
  - v5 should forbid D-ids as justifications in code and drop them in the port. Code then states behaviour; history stays in the generated record.
- **Registry for commands:** ev4 tried this (spec.actions) and stalled at 0 of 13 chat tools, because migration was optional ("when a task touches them"). In v5 the registry has to be the only way to define a tool, button or schedule entry: generate the tool list from it and fail the build on any tool defined elsewhere.

### Can a builder change one folder with only that folder + CONTRACT.md?
No, not for features. Evidence:
- B-614 and B-619 list 8 touch points for a small feature: vocabulary, write path, Worker route, page module, component, jobs kit, harness check, Gallery. Both are blocked.
- Code-comment spread (a lower bound):
  - B-449: 26 files in 8 dirs
  - B-459: 13 files
  - B-481 and B-456: 9 each
  - B-669: 8
- B-609 was exactly the "new kind in one list, not the others" failure.

A new entity touches domain/ → data/ → commands/ → areas/, plus a migration. "One task, one folder" works only if:
- (i) domain types are the single source and the other layers are generated or type-checked from them
- (ii) a task's context is the folders it writes **plus the public `index` and types of what it imports**
- (iii) cross-cutting work is split into ordered layer tasks, or one task owns a vertical slice with a recipe (B-619)

The minimal change: say "one task, one slice; write access to N named folders; read the others' public types".

### Can the guards be gamed? [inferred, with ev4 precedent]
- **Splitting files into one module in disguise:** ev4 already did this.
  - `page/app` parts are one closure. "Split by tab for the reader" (`build.mjs:32`).
  - `core/steps-worker.mjs` is "split from core/steps.mjs, which merges them into its tables" (`steps.mjs:388`: `Object.assign(CODE_STEPS, WORKER.CODE_STEPS)`).
  - `core/conversation.mjs` is a factory with no imports that takes core's names as arguments, created to stay under the evcore cap (`ev-builder/SKILL.md:39`).
  - Mitigations: dependency-cruiser `no-circular`; folder-private files (eslint-plugin-boundaries entry points); ban `export *` and mutation of imported objects; knip for unused exports; `max-lines-per-function`.
  - A one-way A→B split can't be stopped mechanically. Accept that.
- **Suppression comments (`eslint-disable`, `@ts-ignore`):**
  - run ESLint with `--no-inline-config`, or `--report-unused-disable-directives` plus a CI ratchet on disable count [verify flags]
  - use `@typescript-eslint/ban-ts-comment` and `no-explicit-any`
  - ev4 has zero suppressions today only because it has no linter
- **Allow-lists that "only shrink"** (actions-legacy) froze rather than shrank. Give each ratchet an owner task, or don't add it.

---

## 4. Size of the record [checked]
- `chart/decisions.json`: 382 decisions.
  - By status: 322 accepted, 53 superseded, 4 proposed, 3 revisit.
  - 46 are tenets: 20 accepted, 26 superseded.
  - Accepted tenets by scope: ui 8, ops 7, data 2, data+ui 2, pipelines 1.
- The links between decisions are mostly not recorded:
  - only 32 decisions fill in `supersedes` and 34 fill in `amends`
  - 27 amended decisions are still `accepted`, so you have to read both to know what holds
  - 55 decisions mention amends/replaces/updates D-nnn in their text
  - some reversals aren't linked at all (D-350 vs D-178)
  - So "in force" **can't be computed from status**. Writing CONTRACT.md needs a human sweep of the 322.
- Characters: all decisions 246k. Accepted titles alone 96k; accepted title+why 158k. In-force rules ≈ 7.9k (see §3).
- `chart/rules.json`: 6 rules, 4 ended. `spec.boundaries.rules`: 18, 2 ended. `spec` has 45 `_rules` entries (13.8k chars) in 14 places.
- **Agent-facing prose today:**
  - `CLAUDE.md` 101 lines
  - six SKILL.md files 519 lines (620 with CLAUDE.md, 44k chars)
  - all `.claude/skills` files 1,050 lines
  - `spec.workingAgreements`: 5 entries, 386 chars
  - `tools/kickoff.md` 33 lines

---

## Summary table

| Drift cause | Evidence (paths / ids) | Plan addresses it? | Minimal fix |
|---|---|---|---|
| Page as one global closure split into fragments | `tools/build.mjs:32-48`; `00-boot` +2 / `91-forms` −2 braces; `S`/`T`/`write`/`render`/`morePending` shared across 5–24 files; 141 backward refs; `tools/format-app.mjs` | **Yes** (real modules) | Also ban module-level mutable state that is exported and changed elsewhere |
| Jobs with no single record (R1–R6, esp. in-tab R4) | `bridge.js:752-919`, `planjob.js`, `watch.mjs:219-244`, `20-study.js:1507,1686`; B-688, B-623, B-609, B-471 | **Partly** | Every model call that outlives a reply is a job; job-status tool for E.V.; Mac executor reports into the same record |
| Claim that Workflows fixes B-688 | B-688 is visibility (R4); Q bugs 3 of 38 | **No** (misattributed) | Justify Workflows by deleting `planjob`/staleRuns/refire code; check limits [verify] |
| Claude sessions as runtime (clone, gate, hooks) | B-110, B-167, B-169, B-172, B-187; `tools/gate.mjs` | **Partly** ("scheduled runs are commands") | Scheduled work is Worker code; only the Mac/browser lane stays a session |
| Rules duplicated across CLAUDE/skills/spec/tools | R-03 (`rollback/SKILL.md:13`, `chart.mjs:2100` vs D-350); `spec.jobs._rules[0]` vs D-308; "nothing deleted" ×4; full-suite paraphrases; `boundaries._rules[0]` vs `spec.test.mjs:372` | **Partly** (CONTRACT + verbatim check) | `§id` per rule; skills cite ids only; lint rule-like sentences with no `§id`; ended ids fail |
| Tool descriptions state runtime facts by hand | `72-…:400` "saved as a Claude Doc… Runs in the cloud" vs `jobs.mjs:27`; B-651 | **Partly** (generated tools) | Generate descriptions from command metadata; no hand-written runtime claims |
| Command registry existed but migration was optional | `spec.actions._rules[3]`; 0/13 chat tools; `actions-legacy.json` 32 sites since Oct 21 | **Partly** | Registry is the only way to define a tool, button or schedule entry; build fails otherwise |
| Superseded decisions as live instructions in code | 29 superseded D-ids cited 130× in source (D-314 ×11); D-411; B-620 open | **Partly** ("old decisions are context") | No D/B ids as reasons in code; drop them in the port |
| Decision record can't tell what's in force | 32 supersedes / 34 amends filled vs 55 text mentions; D-350↛D-178 | **No** | One-time human sweep → CONTRACT (~75–150 lines); the record keeps history only |
| Hand-rolled checks that drifted or broke runs | `hooks.mjs` (B-167), harness (B-573/574/393/421/467/655), `d307.mjs` (missed B-468), tokenizer in `actions.test.mjs` | **Yes** (ESLint/knip/boundaries) | Add `@playwright/test`, Stylelint, TS + zod enums; keep `skills-drift` |
| Size caps produce disguised splits | evcore 2,500 cap → `conversation.mjs` factory, `steps-worker` Object.assign merge; page parts | **Partly** (max-lines) | `no-circular`, folder entry points, ban `export *`, knip, `max-lines-per-function`, `--no-inline-config` [verify] |
| Cross-cutting features vs "one task, one folder" | B-614/B-619 (8 touch points), B-449 26 files/8 dirs, B-609 | **No** (unrealistic as stated) | One task = one slice with named write folders + imported public types; domain types generate the rest |
| Vocabulary in several lists | B-609, B-614 (schema / `LIST_KINDS` / `DS.kind` / pickers) | **Partly** (if domain/ is the source) | TS unions / zod in domain/; schemas and pickers generated |
| Cross-runtime double-run hazard | `watch.mjs:225` + `jobHandOff` `fired.ok` + `steps-worker.mjs:30-34` | **Yes** if one runtime | Idempotent job id = Workflow instance id [verify]; one state machine |
