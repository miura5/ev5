# ev4 daily use vs the v5 cutover scope, and the security/cost controls v5 must keep

Evidence from /workspace/ev4 (read-only), as of commit 9d9af38. "CHECKED" means I read it in code or in the chart. "INFERRED" means it is my reading of that evidence. `[unconfirmed]` means the repo cannot settle it. `[verify]` means it depends on current vendor docs.

## Verdict (Topic A)

**No, the cutover scope as written does not cover Matt's daily use.** Three things he uses every day, or that his daily views depend on, are outside it:

1. **Notes, with the study sessions that run inside notes.** The plan defers Notes, but it also makes ev4 read-only at cutover. Together that means Matt cannot write a note at all on cutover day.
2. **The scheduled runs.** Today's review set, Canvas dates, the weekly review, weak-spot parking, push lines and backups all come from them.
3. **The study plan job** (Sonnet, run in the `PlanJob` Durable Object). Its approved tasks *are* part of Today's list.

The rest of the plan holds up:
- Deferring Progress is fine. I found no evidence that Matt uses it daily.
- Dropping flashcards, workouts, mood check-in and skill checklists is already done in ev4 (D-416).
- Leaving out journal writing matches ev4 (D-319).
- No in-app build controls are in use (see row 14).

## A. Feature-by-feature evidence

Matt's words carry a `reportedAt` date in chart/tasks.json. There are 357 such entries, dated Oct 19 to Nov 2. Ids come from chart/tasks.json (B-) or chart/decisions.json (D-).

| # | Feature / job / run | (a) Evidence of use (CHECKED) | (b) In v5 cutover scope? | (c) What breaks on cutover day if missing |
|---|---|---|---|---|
| 1 | **Notes editor** (desktop only, 25-notes.js:2): autosave, paste, headings, two-column rows, **images** (R2 `note-images/`, D-417, pwa/images.js) | Matt's own reports on many separate days: B-437, B-439, B-440, B-441, B-454 (Oct 27); B-474 (Oct 28); B-600, B-601 (Oct 30, "taking notes with E.V. on BIO 201"); B-623, B-638, B-653, B-654, B-658 (Oct 31; images asked for anatomy notes); B-682, B-685 (Nov 1). | **No.** Notes is "after cutover", and ev4 becomes read-only. | He cannot write or edit notes anywhere. ev4's offline outbox (bridge.js:9-14) would hold refused saves on the device. Images exist only in ev4's R2 and are served only by ev4's Worker (images.js:6). |
| 2 | **Study sessions and E.V.'s session comments.** A note's session or a Today task's session (64-ev-study-sessions.js:2-5). Writing-time timer (D-353). Read-along on by default (D-339). Check cards and the note side chat ("Quiz me on this note"). | D-424 and B-685 (Nov 1): her session comments run to **"about 20 a day"**, so sessions run daily. Also B-418, B-438 (Oct 26-27), B-623, B-638 (Oct 31), B-682 (Nov 1). Progress's study time comes only from `sessions` (30-progress.js:2-5). | **No.** Sessions live in Notes. Only the phone's fallback session runs inside the Conversation (64:2-3). | No timed study, no read-along, no check questions, no logged study minutes. Today's **Start** button opens a session (10-today.js:398-400), and a note task's **Write** opens Notes (10-today.js:387-397). Both dead-end if Today is v5 and Notes is read-only ev4. |
| 3 | **Study plan job** (`exam-plan`). Sonnet make/remake runs in the `PlanJob` Durable Object (pwa/planjob.js, wrangler.toml B-459). Edits are Haiku patches (D-356). Study > Plan has Approve, Ask for changes, Put away, Add exam. | Heavy use Oct 27-30: B-449, B-450 (Oct 27); B-465, B-469, B-470, B-476, B-477, B-483 (Oct 28, several on live); B-491, B-498 (Oct 29, live); B-577 (Oct 30). docs/study-plan-brief.md is the rubric. | **Partly at best.** Neither of the skeleton's two jobs (mock exam, practice set) is this job. "Today matches ev4" implies plan tasks on Today. | Approved plan tasks are on Today with a tick shared with the plan (B-483, 10-today.js:69-72 `withPlanTasks`). Without the plan job he cannot make a plan, remake one or ask for changes. Two exams (11/2 and 11/4) appear in B-476/B-477, so plans for upcoming exams are a live need. |
| 4 | **morning run** (cloud, 4:25am Central; spec.tasks.live.morning). Writes `days` (the saved list), the **review set** (`sets`), drills and `predictions`. | The page shows "Today's review appears after the 4:25 am run" (20-study.js:67; index.src.html:109). Today falls back to a live plan (10-today.js:16, 69-72), but the review set has **no fallback**. | **No.** Runs only "become commands the schedule calls". No cutover date is attached. | No daily review questions, no planned drills, no predictions. The FSRS review in Library could replace the review set **only if** it is live at cutover. |
| 5 | **evening-cloud** (8:15pm). Parks weak spots after exams, writes `state` and tomorrow's prep check, and composes the push line. | B-252, B-253 (Oct 23): parking bugs Matt hit. Prep/"what to bring": B-189, B-190 (Oct 21), and Today's Prep row in B-625 (Oct 31, Matt). | **No.** | Past exams' weak spots flood review (the B-252 failure mode). No prep check, no evening push. |
| 6 | **evening-mac** (8:20pm, **Mac-bound**). Reads Canvas through Matt's signed-in browser and writes `dates`, `exams`, `materials`, `announcements` (spec.collections writers `canvas-sync`). Also the nightly Mac backup and the Sunday Markdown mirror (D-302, D-303, D-322). | Re-created with Matt Nov 1 (docs/handover.md:19, 24). Canvas data feeds Today, plans, prep and the library search (71-ev-library.js:2). B-260 (class-day errors). | **No.** "Mac tasks must be re-created with Matt present." | Canvas date and announcement changes stop. The Mac backup and mirror stop. If v5 writes elsewhere than ev4's D1 while ev4 is read-only, this run's writes are refused. |
| 7 | **weekly** (Sunday 5:57pm). Writes `weeks` and `concepts`. The review shows in Today's side panel (index.src.html:77). | B-684 (Nov 1, Matt's screenshot): he reads it and wants it structured. | **No** (unless Today v5 counts it as part of Today). | Today's weekly panel goes stale. |
| 8 | **watchdog** (8×/day), **restore-drill** (monthly, Mac-bound), **R2 nightly export** (Worker cron, worker.js:34-37) | Infrastructure, not used directly. The restore drill ran Nov 1. | **No** | Silent run misses go unflagged. No backups of whatever v5 writes. |
| 9 | **Push notifications** from scheduled runs (`push: true` on live tasks; constants.push "what the notification shows on his phone") | B-172 (Oct 21): notifications reached his phone. B-166 (Oct 21): a 3:59am staging push reached it. | **Not addressed.** | The phone's main daily role is INFERRED to be these pushes. If v5's schedule is not Claude Code tasks, pushes stop `[verify how v5 schedules]`. |
| 10 | **Phone** (installed iPhone PWA). Conversation, Today ticking, Study quiz, Record. Notes is not on the phone (25-notes.js:2). | B-428, B-432, B-433 (Oct 27, live iPhone app). D-394 and D-407: he "rarely" or "barely" uses it. D-407 names the future phone basics as Today ticking, chat, flashcards and a quick note. | "Frozen at it works" | The home-screen app points at the ev-live URL (D-330). If v5 lives at a new URL, the phone keeps opening read-only ev4 until it is re-installed `[unconfirmed v5 URL plan]`. |
| 11 | **Exams, objectives, weak spots.** Add exam (80-new.js:7; B-465, B-477). `record_score` auto-starts an `exam-retro` job (72-ev-talking-with-claude.js:450-490). Weak-spot propose/accept flow (B-455, B-499). | B-455 (Oct 27), B-465 and B-477 (Oct 28), B-478 (Oct 28, live), B-266 (scores, blocked). | **Unclear.** "Library (practice and FSRS review)" may or may not hold them `[unconfirmed]`. | Without Add exam or weak-spot accept, new misses never become weak spots, and plans have no exam to anchor to. |
| 12 | **Ask E.V. tools** (72-ev-talking-with-claude.js:352-1024): show_card, start_job, record_score, add_weakspot, edit_dates, tick_item, edit_list, lookup, materials, save_idea, make_practice, quiz_me, study_session | Daily: B-452 (Oct 27); B-478, B-479 (Oct 28); B-592 (Oct 30); B-624, B-626 (Oct 31); B-669, B-681, B-683, B-687, B-688 (Nov 1); B-689 (Nov 2) | **Yes**, provided the tools are ported, not only the chat | `edit_dates`, `edit_list` and `study_session` depend on rows 2, 3 and 6. |
| 13 | **Other job kinds**: study-guide, clinical-prep (also a quick ask, 70-ev-quick-asks.js:28-32), exam-retro, share-set (D-110), general | **No Matt report** in the chart. B-649 (open), the task to read live counts for predictions, share-set jobs, concepts and ideas, has not been done. | No | Probably little harm (INFERRED). Read live `jobs` counts by kind before deciding. |
| 14 | **In-app "Ship it" / Job taps** (62-ev-jobs-and-filing.js:426-491) | They need the claude.ai connector, which the PWA does not have (bridge.js:17 "mcp: none"; spec `jobs.builderOnLive` is false; D-304). All 57 live deploys in chart/deploys.json have `okFrom: "Matt"`; the repo does not show whether that OK came by a tap or in the chat `[unconfirmed]`. | n/a | Nothing. These taps do not work in the app Matt uses. |
| 15 | **Record** (Notes / Sessions / Quizzes / Everything log, 40-record.js) | B-433 (Oct 27, phone); B-685 (Nov 1, Record's Notes list) | Probably maps to Activity `[unconfirmed]` | Without it he has nowhere to see what he logged. |
| 16 | **Progress** | Only fidelity, UX-probe and build-manager items (B-342, B-522, B-591). No Matt words about using it. | Deferred (fine) | Little harm. |
| 17 | Captions / lecture recordings | **No lecture-recording feature exists.** "Captions" is E.V.'s conversation display (61-ev-captions.js:1-5). A grep for recording/lecture found none in the chart. | n/a | Nothing. |
| 18 | Journal, workouts, mood, flashcards, skill checklists | Journal: no page writing since D-319. The rest were retired by D-416 (B-644 to B-647). | n/a | Nothing. Quizlet stays his flashcard tool until FSRS exists. |
| 19 | Offline | Only note saves work offline (outbox in bridge.js:9-14). Every other write is refused offline. No Matt report of offline use. | n/a until Notes ports | Matters only together with row 1. |

### The read-only contradiction

The plan says both "ev4 becomes read-only before v5 writes" and "ev4 still serves" Notes and Progress. The code shows these cannot both hold:

- ev4's only read-only switch is for the retired claude.ai page. The PWA is explicitly exempt from it (`READ_ONLY` excludes host `ev-app`, page/app/04-model.js:37; bridge.js:1267). The Worker has no write-freeze switch (worker.js:39-174), so v5 would have to add one.
- A freeze would refuse **(a)** note saves and session logs, **(b)** the scheduled runs' run-API batches (worker.js:51) and **(c)** Notes' offline outbox.
- Matt writes notes daily (row 1) and Today's Start/Write route into Notes (row 2).

So the choice is one of two:
- **(i)** Keep ev4's notes and sessions writable after cutover. That means two writers to one record, or two records.
- **(ii)** Port Notes and sessions into the cutover scope.

## B. Security, privacy and cost controls today (CHECKED unless marked)

**Auth**
- One bearer token, `EV_TOKEN`, guards every `/api/*` route (worker.js:43-46).
- Non-`/api` paths are served from static assets **before** the token check (worker.js:41). So the shell, app.js, core.js and `spec.json` are public at the workers.dev URL. `spec.json` carries `courses`, `constants` (including the prep kit), `study`, `persona` and the plan instructions (tools/build.mjs:372-410). That is low-grade personal context.
- The compare is constant-time: both sides are SHA-256 hashed, then compared with `timingSafeEqual` or a full XOR loop (guard.js:8-24, B-389).
- There is no lockout or rate limit on wrong tokens (worker.js). Mitigation is D-346 (a 20-character password).
- Storage and sending:
  - On the device, the token sits in `localStorage['ev.token']` (bridge.js:24-32, 272), entered once in a password field (bridge.js:258-276).
  - It is sent as `Authorization: Bearer` (bridge.js:38-41).
  - The whole record is cached unencrypted in IndexedDB `ev-app` (bridge.js:54-121).
- The same token serves the app and the scheduled runs (D-301).
- The runs keep it in their task instructions (D-309). B-668 (open) says the run token is also still in the claude.ai record's `system/worker`.
- Anyone holding the token can raise the token ceilings up to 50M a day via `PUT /api/claude/limits` (claude.js:20, 409-429).

**Secrets**
- Live `ANTHROPIC_API_KEY` is a Cloudflare secret Matt sets in the dashboard. The workflow only checks it exists (pwa-live.yml:150-153; D-299).
- Staging key: the GitHub secret `ANTHROPIC_API_KEY_STAGING`, put on ev-staging by the staging workflow (pwa-staging.yml:72, 188; D-310).
- `EV_LIVE_TOKEN` is a secret in the GitHub `live` environment (pwa-live.yml:57, 63, 148). `EV_STAGING_TOKEN` is a repo secret.
- The key never reaches the browser:
  - The Worker adds `x-api-key` itself (claude.js:507).
  - It ignores any model the page sends (claude.js:122-125, 511).
  - It strips the page's `cache_control` (claude.js:286-319).
  - It sends only to api.anthropic.com or localhost (claude.js:269-274).

**Personal data**
- tools/personal-data.mjs (with test/personal-data.test.mjs) flags record exports, backups and Study Watch files by path and JSON shape (lines 75-116). It does **not** scan free text or images.
- `.gitignore` covers `fixtures/`, `dist/`, `pwa/.dev.vars`, `pwa/seed.sql` and `pwa/public/`.
- The repo is public (docs/handover.md:3). spec/ev.spec.json still contains the Mac folder path (it includes a Mac account name) and the school's Canvas host. I describe these and do not quote them.
- Worker logging: only errors, token counts and job ids (claude.js:45, 99, 104, 194, 481, 490, 559; planjob.js:201, 280). It never logs prompts or note text.
- Note text may be stored, backed up and sent to the model under D-328. D-335 opens the whole record to runs and agents.
- Proof screenshots:
  - Taken on the synthetic record or seeded staging (ev-builder SKILL.md:60-65; wrangler.toml:16-18 "made-up record only").
  - Nightly artifacts are kept 14 days (nightly.yml upload-artifact).
  - Matt's live screenshots exist only in chats.
- Nothing is hard-deleted:
  - The run API has no delete path (B-312, D-345).
  - R2 exports are never overwritten (worker.js:11-12).
  - D-425 now allows a 30-day purge of items Matt himself deletes. That is not built yet (B-422, B-686 open).

**Cost**
- Hourly and daily token ceilings live in D1:
  - Defaults are in claude.js:15-18. The stored setting (`claude_settings`) wins over Worker vars, which win over the defaults (claude.js:27-49; D-349, B-435).
  - Usage is tallied in `claude_usage`, one row per hour, with the day in Central time (claude.js:208-257).
  - Cache tokens are weighted as billed (D-352), and Sonnet tokens count 3× (claude.js:115-120, 132).
- Over a ceiling: `/api/claude` answers 429 with a plain sentence and a reset time (claude.js:228-248).
- Plan cap: two Sonnet asks per plan job, claimed atomically in `claude_plan_asks` (claude.js:165-206). The Worker also checks the job is a running exam-plan job under a day old (claude.js:169-187).
- Read-along: at most one read per note per 75 s, and only on changed text, enforced in `claude_reads` (claude.js:21, 322-339). The 10-minute idle stop is in the page.
- Ceiling hit mid-job:
  - Plan jobs check for room before the first ask (jobs.mjs:371-395).
  - Any job hitting a ceiling is marked failed with the Worker's sentence (jobs.mjs:630-641; planjob.js:109; bridge.js:820-826).
  - The ceiling toast shows once per ceiling (B-430).
  - A lost body or a cut-off answer counts a conservative estimate (claude.js:259-267, 484-492).
  - Gap: B-457 (open) says a billed Sonnet ask can still go uncounted.
- **No monthly ceiling and no alert to Matt.**
  - The money stop is the Anthropic Console's monthly spend limit (D-299: $5; D-349).
  - Whether it is still set is open: B-310, docs/handover.md:16.
  - The usage meter D-339 promised was never built. `/api/claude/usage` returns only the hour and the day (claude.js:405-406).
- Prompt caching is used:
  - The note-chat prefix (bridge.js:1150).
  - Plan asks, two marks (jobs.mjs:198-201).
  - The Worker allows at most two marks (claude.js:289) `[verify cache TTL and pricing]`.
- Models:
  - The Worker picks the model by purpose (`PURPOSES`, claude.js:127-158; D-305, D-355, D-356). Sonnet is used only for a new study plan. Plan edits, practice sets and everything else use Haiku.
  - Model ids are hard-coded fallbacks at claude.js:130, 136, 141 and 149, overridable by the Worker vars `CLAUDE_MODEL` and `CLAUDE_PLAN_MODEL`, and pinned in tests (e.g. test/quiz-topic.test.mjs:81-94).
  - **There is no "checked on" date for any model id** (grep). Answer caps (8,192 / 16,000 / 32,000 / 48,000) are at claude.js:126-141 `[verify against current model limits]`.
  - Scheduled runs are Claude Code cloud tasks. Their model and cost sit on Matt's Claude plan, not the API key `[unconfirmed]`.

## Missing from v5 cutover scope (ranked by harm to daily use)

1. **Notes and note study sessions.** Editor, images (R2 `note-images/`), writing timer, read-along, check cards, side chat, and session filing into Record. Daily use (D-424, about 20 comments a day). Read-only ev4 blocks all of it, and Today's Start/Write dead-end into it.
2. **The morning run's review set and drills.** Daily, at 4:25am. There is no fallback in the page unless v5's FSRS review is live at cutover.
3. **The study plan job.** Make, remake and edit; Sonnet in a Durable Object; Approve putting tasks onto Today with a shared tick. In heavy use Oct 27-30 with exams on 11/2 and 11/4. Not among the skeleton's two jobs.
4. **evening-mac** (Canvas sync, Mac backup, Sunday mirror) and **evening-cloud** (weak-spot auto-park, prep check, push). These need Mac-task re-creation with Matt present before ev4 stops taking writes.
5. **Exams, weak spots and objectives.** Add exam, record_score with its exam-retro, and weak-spot accept. Placement in Library is `[unconfirmed]`.
6. **Push notifications to the phone**, and where the installed phone app points after cutover.
7. **weekly run** (the review in Today's side panel, B-684), **watchdog**, **restore-drill**, and the **R2 nightly export** for whatever database v5 writes.
8. **Record**, if Activity does not replace it at cutover.
9. **Low or unknown use:** the study-guide, clinical-prep, share-set and general jobs, and predictions. Settle with live counts (B-649).

## Security/cost controls v5 must keep (with ev4 path)

- Constant-time token check on every API route, SHA-256 then timingSafeEqual: pwa/guard.js:18-24, pwa/worker.js:45. Add what ev4 lacks: an auth gate on static assets or `spec.json`, and a wrong-token rate limit.
- API key held only on the server; the server picks the model and max_tokens; page `cache_control` stripped; outbound host pinned: pwa/claude.js:122-158, 269-274, 286-319, 501-519.
- Hourly and daily token ceilings as a D1 setting changeable without a release, cache-weighted, with Sonnet weighting: pwa/claude.js:15-66, 75-120, 208-257, 404-429 (D-349, D-352). Add a monthly cap or meter, and an alert; ev4 has neither.
- Per-plan-job Sonnet ask cap tied to a running job in the record: pwa/claude.js:161-206 (B-449).
- Read-along limits: changed text only, 75 s gap, atomic claim: pwa/claude.js:276-339 (D-339).
- A conservative estimate counted for billed-but-lost answers; retry only before an answer starts: pwa/claude.js:83-110, 259-267, 520-549. B-457 is still open.
- A ceiling hit fails the job cleanly in the Worker's words, with a pre-flight room check: pwa/jobs.mjs:371-395, 630-641; pwa/planjob.js:109.
- Version-pinned writes (409 on stale) and canonical JSON: pwa/worker.js:90-154; pwa/runapi.js (B-389, B-398).
- No delete path for runs and agents; R2 exports never overwritten; the restore drill: pwa/runapi.js, pwa/backup.js, worker.js:34-74 (D-302, D-345).
- Note and image storage served only behind the token, with an 8 MB cap and a type whitelist: pwa/images.js (D-417). B-656 (open) still lists hardening gaps: nosniff on image reads, 400 instead of 500 on a malformed key, and the size check made before reading the whole body.
- Secrets placement: live key as a Cloudflare secret only, a separate capped staging key, and the token in the GitHub `live` environment: .github/workflows/pwa-live.yml:57-63, 148-153; pwa-staging.yml:69-72, 187-188 (D-299, D-310).
- The personal-data scan plus the `.gitignore` of `fixtures/` and `dist/`: tools/personal-data.mjs, test/personal-data.test.mjs, .gitignore. Consider extending it to text and images, and removing the Mac path from the public spec.
- No prompt or note text in Worker logs: pwa/claude.js and pwa/planjob.js console.log sites listed above.
- Proofs on synthetic data only: wrangler.toml:16-18, the ev-builder skill.
