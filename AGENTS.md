# E.V. v5: the agents' playbook

How the agents turn `PLAN.md` into tasks and build v5 with almost no time from Matt. Once CONTRACT.md exists, its rules win over anything here. This file is procedure.

## 1. Roles

| Role | Who | Does | Not theirs |
|---|---|---|---|
| **Build manager** | A cloud scheduled Claude Code task ("E.V. v5 build"), one run at a time (the run lock, §3 step 0) | Picks the batch, starts builders, reviews, ships staging, writes the handover and release card, asks Matt only what §6 allows | Deploys live, changes ev4's live data or tasks, decides a §6 question for Matt |
| **Supervisor** | Claude in Matt's "ev-build" channel (since 2026-11-03; before that his main chat) | Checks the handover, CI, staging and the run lock a few times a day; fixes stalls and overlaps; tells Matt when something is ready to try or needs him | Builds tasks while a run holds the lock, deploys live, decides a §6 question for Matt |
| **Builder** | A subagent started by the build manager, one per task | Builds one task in its slice, proves it, opens a PR | Touches folders outside its slice, ships, writes the Chart, holds Cloudflare credentials |
| **Spike** | A subagent | Answers one question in a throwaway branch, then reports causes, counts and a recommendation | Commits to main |
| **Reviewer** | A fresh subagent, once per release | Reads the release diff for lost or wrong data, cost, security, crashes and unreachable controls. Checks each merged task against every §id its source cites (the libraries and structure those rules name) | Edits code |
| **Design agent** | Started by Matt (mock-up phase) or by the build manager (a big UI ask) | Iterates `design/mockup.html` within `design/DESIGN-BRIEF.md` | Changes rules in PLAN or CONTRACT |

Each run uses 2 to 4 subagents at a time.

## 2. Where state lives (runs are stateless)

Every run starts from a fresh clone, so everything that matters is in the repo.

| What | Where |
|---|---|
| Rules | `CONTRACT.md` (`PLAN.md` before Phase 0's gate) |
| Tasks, decisions, history | the Chart: `chart/*.json`, written only by `ops/record` (Phase 0 task S-02). Before it exists: `docs/handover.md` |
| Run lock | the branch `claude/build-lock`, moved only by `ops/build-lock.sh` (§3 step 0) |
| Current state | `docs/handover.md`, rewritten at the end of every run (see the format in §7) |
| Questions for Matt | one pinned GitHub issue, **"For Matt"**, mirrored in the handover's **Waiting on Matt** |
| What Matt sees | the release card (§8), posted as a comment on the "For Matt" issue. He gets it as a GitHub notification and replies there |

## 3. One build run, step by step

0. **Take the run lock** before anything else: `ops/build-lock.sh take`. Exit 3 means another run is working: end this run at once, with no handover, wait branch or PR. After each merged batch, run `ops/build-lock.sh renew`. Run `ops/build-lock.sh release` just before you open the handover or wait PR (step 10), and also when the run ends early. A lock held for more than 75 minutes is stale and the next run takes it. Other sessions (the supervisor, a channel thread) may open PRs at any time, but they merge to main only while the lock is released (`ops/build-lock.sh status`), or they give their Chart filings to the running build manager: each outside merge puts every open build PR behind main.
1. **Read** `docs/handover.md`, then CONTRACT.md (PLAN.md before Phase 0's gate).
2. **Check on last run's work:** open PRs, CI results, staging health. A red main, or a red `staging` deploy on main, is fixed first, before anything else.
3. **Read Matt's input:** new comments on the "For Matt" issue (answers, "bug: …", "idea: …", "ship", "exam week", "go live"). File each one in the Chart. A bug that breaks studying jumps the queue.
4. **Pick the batch:** the lowest open tasks whose dependencies are done, within the current phase, sized so the batch can reach a staging deploy or a gate in this run. A gate held up only by Matt or an outside input doesn't stop the build: start the next phase's tasks that don't need that input, and close the gate when it arrives. Gate 6 (before Matt tests) and anything live still wait for every earlier gate.
5. **Claim** each task in the Chart (the claim is the lock), then start builders: one task each, with its slice and context (§5). The run lock keeps other runs off these tasks, so the claims, done marks and notes go in the run's handover PR. Open a separate Chart PR first only when the run files new task ids, because ids race.
6. **Merge:** each builder runs `npm run precheck` (every CI check, the Interface-trailer check included), then opens a PR from a `claude/` branch with auto-merge on. GitHub runs every check, and auto-merge lands it on green. Nothing reaches main any other way. Main takes only branches that are up to date, so land one PR at a time: when a PR merges, update the oldest open PR at once (`gh api -X PUT repos/miura5/ev5/pulls/N/update-branch`; if no CI run starts within a minute, merge main into the branch and push). A green PR that sits behind main is lost time.
7. **Ship staging:** merging to main deploys the v5 staging Worker automatically. When a batch changes model behaviour, a job or an outside call, do **one real end-to-end run** on staging.
8. **Gates:** when a phase's gate conditions are all true, record the proof (links to CI runs, drill output) as a Chart decision and move the handover to the next phase.
9. **Card:** when something is on staging that Matt can try, update the release card (§8). Otherwise send no message.
10. **Repeat or hand over:** while there is time left in the run (about 50 minutes) and work that doesn't wait on Matt, go back to step 4. Then wait for this run's PRs to merge, rewrite the handover from the latest main (§7), release the run lock, and open the handover PR last, on a branch named `claude/handover-<UTC time>`: its merge starts the next run. Name it `claude/wait-<UTC time>` only when every open task waits on Matt or an outside input. Before that, check each **Waiting on Matt** item against the "For Matt" issue and the Chart, and remove the answered ones.

**Stop early when:**
- the next step needs Matt (§6): write the question and keep doing everything else it doesn't block;
- usage is running out, or the run has to end for another reason: finish the current builder, turn on auto-merge for every open PR of this run, write the handover and open the handover PR anyway, so the next run starts at once and lands those PRs;
- the same check fails twice on a builder's fix: start a spike instead of a third try.

## 4. Turning the plan into tasks

### 4.1 Task template (one Chart entry)
```
id:        B-nnn (continues ev4's sequence)
title:     <what changes, in Matt's words if it's visible to him>
phase:     0–7 | after-cutover
slice:     write: [folders]   read: [folders whose public interface it imports]
depends:   [ids]
done when: <observable bar: a test, a gate item, a screen in the mock-up>
proof:     <the checks or journeys that show it>
interface: none | <folder> (then expand → migrate → contract, PLAN §11)
```

### 4.2 Sizing and slicing rules
- One task changes one slice, reaches a green PR, and stays under about 400 changed lines. Split anything bigger along the layers: domain → data → commands → jobs → areas.
- **A new entity** is ordered tasks:
  1. `domain/<entity>` (schema and rules);
  2. `data` repository, writing through the gate (§data.gate);
  3. commands;
  4. the area part.

  Each later task reads the earlier ones' generated interface only.
- UI tasks name the mock-up screen they implement. A look the mock-up lacks starts as a kit task, never in a view (§ui.kit-leads).

### 4.3 Seed tasks
The first run files these into the Chart, then the loop takes them in order. Ids are assigned when they are filed.

**Phase 0: Decide and freeze**
- S-01 Bootstrap the repo: the skeleton from PLAN §4, `CLAUDE.md` (a pointer to CONTRACT and this file), `docs/handover.md`, and the pinned "For Matt" issue. Done when the tree matches PLAN §4 and CI runs an empty check.
- S-02 The record writer `ops/record`. Carry ev4's `chart/*.json` unchanged. Keep the field names and id formats. Render BACKLOG and DECISIONS. Lint the links. Freeze `deploys.json` as v4 history. Done when the renders match ev4's for the carried data.
- S-03 File the seed tasks (this list) through `ops/record`.
- S-04 Record Matt's confirmations (PLAN §15) as decisions. Any unanswered item keeps its default, marked "default".
- S-05 Sweep the 322 accepted decisions plus PLAN §2–§12 into CONTRACT.md, giving every rule a `§id`, and list the ended rules. Done when the hard-limits section is marked for Matt's yes (the only CONTRACT question he gets).
- S-06 `data/compat`: frozen ev4 schemas, protocol tests (`v`, `at`, canonical JSON, 409, no delete), and ev4's route list. *(Ended 2026-11-05: v5 has its own database, §data.own-db.)*
- S-07 Spike Workflows (PLAN §13 Phase 0 list) on the current plan tier. Report pass/fail per item and the recommendation.
- S-08 Spike the notes editor round trip (ProseMirror/Tiptap ⇄ ev4 blocks) against synthetic notes and the ev4 notes-harness behaviours.
- S-09 *(ev4 repo, bug fix)* Remove the Mac path and Canvas host from ev4's public spec. This is an ev4 task, and it ships through ev4's process.
- **Gate 0:** S-04…S-08 done, and Matt's yes on the CONTRACT hard limits.

**Phase 1: Repo, guards, walking skeleton**
- S-10 TypeScript, Vite, React and Vitest base. One "hello" area.
- S-11 ESLint (`max-lines`, `ban-ts-comment`, inline disables refused), dependency-cruiser rules from PLAN §4, Stylelint tokens-only, knip.
- S-12 Custom checks, kept small: presence (stories and tests), registry-only definitions, the CONTRACT/skill/README rule check, the interface-trailer check, the secrets scan (PLAN §10, changed by Matt on 2026-11-02).
- S-13 Generated files: registries, folder READMEs' interface and must-not lines (§drift.interface), `commands/client.ts`. Then regenerate-and-diff in CI.
- S-14 Guard-failure fixtures: a PR per guard that goes red, recorded.
- S-15 CI: branch protection, auto-merge, the staging deploy on merge (Cloudflare credentials only in GitHub), the live workflow behind Matt's approval.
- S-16 The v5 staging Worker with a synthetic D1: synthetic v5 rows through the gate.
- S-17 The rollback runbook and rehearsal 1. *(Ended 2026-11-05: no rollback to ev4, §data.own-db.)*
- **Gate 1.**

**Phase 2: Kit (parallel with Phase 3)**
- S-20 `tokens.css` from ev4's values, matching `design/mockup.html` in both themes. Normalize the kit's stray sizes (13, 13.5 and 11 px in buttons, nav, tabs, kbd and tag) to the three text sizes, or record the exception in CONTRACT.
- S-21…S-3x One task per first-set component or pattern (PLAN §7), each with its story and test.
- S-3y The `/kit` gallery route and Playwright visual baselines in Docker.
- **Gate 2.**

**Phase 3: Domain and data**
- S-40 `domain/time`, with the DST tests and the "due by Central date" rule.
- S-41…S-48 Entities, smallest first: goal, objective, weak spot, set, item, session, note, collection, with their own tests.
- S-49 D1 repositories over `docs`, with Zod parsing and the protocol.
- S-50 The migration baseline, and the `deletions` table.
- S-51 The export of every table in v5's export kind, plus a restore into scratch.
- S-52 `domain/search` and its retrieval test set.
- S-53 The scratch-copy parse check (needs Matt's OK; counts only). *(Ended 2026-11-05: v5 starts empty, so no copy of live data is checked, §data.own-db.)*
- **Gate 3.**

**Phase 4: Commands, runtime, server**
- S-60 The command registry, `defineCommand`, propose mode and generated tools and descriptions.
- S-61 The job record, `defineJob`, executors and `job_status`.
- S-62 The Workflows runtime: steps, the single retry layer, needs-you as a D1 state, continuation.
- S-63 Ceilings: hourly, daily, monthly, per-job, with the pre-flight reservation and the 80% alert.
- S-64 Structured output plus validation, the repair ask and citation checks; `models.ts` with its "checked on" date.
- S-65 The practice set job (and the full practice run variant).
- S-66 The prep plan job.
- S-67 Hono routes, scoped tokens, rate limiting, and ev4-route 410s.
- **Gate 4.**

**Phase 5: Shell and areas** (one task per mock-up screen part)
- S-70 Shell: sidebar from `area.ts`, Detail panel, ⌘K.
- S-71 Activity.
- S-72 Today.
- S-73 Library: practice, weak spots, Dates with their prep plan, sets, the accuracy line.
- S-74 Ask E.V.
- S-75 The notes editor.
- S-76 Sessions and read-along.
- S-77 The offline outbox. *(Its ev4-outbox import ended 2026-11-05: v5 starts empty, §data.own-db.)*
- S-78 The e2e journeys from Gate 5.
- **Gate 5.**

**Phase 6: Ops**
- S-80 Scheduled commands: morning, evening, weekly.
- S-81 Optional Canvas import from the Mac, after cutover.
- S-82 The push task (C7).
- S-83 Restore drills, including a Time Travel restore on staging.
- S-84 Rehearsal 2. *(Ended 2026-11-05: no rollback to ev4, §data.own-db.)*
- S-85 One end-to-end run.
- **Gate 6.**

**Phase 7: Review and Matt's test**
- S-90 The whole-repo review.
- S-91 A UX pass against the rules and the mock-up.
- S-92 The release card. Matt tests.
- **Cutover:** the checklist in PLAN §13, on Matt's word.

## 5. What a builder's brief contains

The task id, its slice (write and read folders), the done-when bar, and the mock-up screen if it's UI. Also:
- the related running tasks;
- for model-path tasks, "read current Anthropic docs, never ids or prices from memory" (§model.from-docs);
- every library and structural rule from the PLAN or CONTRACT sections the task cites, quoted with its §id, not only the section number (for example: §ui.mockup, "unstyled Radix primitives and cmdk for behaviour").

Builders **refuse and report** when a task needs a folder outside its slice. The build manager then splits the task or marks an interface change.

## 6. What goes to Matt, and how

Only these reach Matt:
- live deploys and rollbacks;
- the CONTRACT hard-limits yes;
- ~~the scratch-copy check OK;~~ *(Ended 2026-11-05: v5 starts empty, so no copy of live data is checked, §data.own-db.)*
- money, accounts and secrets;
- anything on his Mac (the Mac executor, re-creating tasks);
- changing something he uses daily;
- an exception to something he asked for.

Everything else the build manager decides and records.

**Format:** one comment on the "For Matt" issue, mirrored in the handover's **Waiting on Matt**:
- the question in one line;
- 2–3 options with the default first;
- "reply with a number, or 'ok' for the default".

Questions are batched. Never more than one message per run, and none while Matt has said "exam week" unless something is broken (§who.asking).

## 7. Handover format (`docs/handover.md`, current state only)

```
## Phase      <n> · gate items done / total
## Running    <task · branch · started>  or "nothing"
## Waiting on Matt   <the batched questions>  or "nothing"
## Next       <next batch in order>
## Staging    <version · commit · what to try>   ## Live  <ev4 build | v5 version>
```

**Next keeps an agreed order.** When Matt (or the supervisor for him) agrees an order for the build, the Next line says so, with the date. When you rewrite Next, read it from the latest main, not from the start of the run, because the supervisor can change it while you work. Keep the agreed groups and their order: drop the tasks that are done and put new tasks in the group they belong to. Only Matt or the supervisor changes the order.

## 8. The release card (what Matt reads)

Posted as one comment on the "For Matt" issue. Written in plain words, short:
- **What you can try on staging**, by screen.
- **What it means for your studying**, in one line.
- **Anything waiting on you** (§6).
- **Health:** the end-to-end run result, the cost of the run, any known risk.

No jargon, no commit lists. Screenshots at desktop 1280.

With each card, update `README.md` when the release changes the stack, the folders, the setup or Matt's part. `npm run checks` fails when its stack table and `package.json` disagree.

## 9. Cadence and usage

- The build task runs on a schedule chosen to fit the daily cap left after ev4's own scheduled runs (PLAN §15 C11) **[verify the plan's current cap]**. Matt can also trigger "Run now".
- Each run is bounded: it ends after its handover. When usage runs out mid-run, the run stops at a safe point. The next run resumes from the handover.
- ev4 keeps running live throughout. ev4 bug fixes stay in ev4's own process; this loop never touches ev4's repo except S-09 (§hard.ev4-own-process).

## 10. Off limits

- Deploy live, roll back, or change ev4's live tasks or data without Matt's explicit word (§hard.live-on-matts-word, §hard.ev4-own-process).
- Commit live data or copy it onto staging (CONTRACT §sec.live-data).
- State model ids, prices or platform limits from memory (§model.from-docs).
- Add a rule anywhere except CONTRACT.md (§drift.one-file).
- Merge without green checks, or disable a check to get green. A known failure is fixed first. A quarantined check expires (§drift.green).
- Delete ev4's resources or Matt's data. v5's own throwaway and staging resources may be cleaned up (CONTRACT §deliver.cleanup).
