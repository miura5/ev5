# Cutover checklist and run record

Rules: §deliver.cutover, §deliver.window, §hard.live-on-matts-word, §hard.data-never-lost, §hard.ev4-own-process, §who.matt, §data.export. Source: PLAN §13 (Cutover, Rollback) and PLAN §8 (scope).

Nothing here starts until Matt says go (§hard.live-on-matts-word). Agents never deploy live: the live deploy runs through the approval-gated `live` environment and only Matt approves it. The build manager walks the list, fills the run record below (copy it into the Chart as a decision when done), and stops at each step marked **Matt**.

## Before the day

- [ ] Gate 6 and Gate 7 are closed in the Chart, the review is done, and Matt has tested on staging.
- [ ] PLAN §8's scope matches or beats ev4 (Matt's word, not the build manager's).
- [ ] The rollback runbook is rehearsed: `ops/ROLLBACK.md` (rehearsal 1 and 2 recorded).
- [ ] Matt has said "go live" on the "For Matt" issue, and has not said "exam week".

## Steps

| # | Step | Who | Needs Matt's word | Proof to record |
|---|---|---|---|---|
| 1 | **Outboxes empty.** Ask Matt to open ev4 on every device he uses and wait until its outbox shows nothing waiting. (PLAN §13 Cutover 1) | Matt on each device; build manager asks and records | Yes (his devices) | Matt's reply naming each device; v5 has no outbox to drain yet |
| 2 | **Scratch-copy parse check.** Matt exports his live record to a private file outside the repo, readable only by him. The build manager runs `node data/scratch-check/cli.ts <file>` on it: counts and error kinds only, never content. Zero parse errors, or each error kind explained and fixed first. (D-457 moved this check here; it needs his OK) | Matt exports and says OK; build manager runs | Yes | The printed counts and error kinds pasted in the run record; Matt deletes the file afterwards |
| 3 | **ev4 cloud tasks off.** Disable (mark disabled, never delete) ev4's cloud scheduled tasks. List them by name. (PLAN §13 Cutover 2, §hard.ev4-own-process) | Build manager, on Matt's word | Yes (ev4's live tasks) | The list of tasks disabled, with the time |
| 4 | **Mac tasks re-created for v5**, with Matt present, in a session that has the Mac link. Tasks are created, never edited in the desktop app. Prove each with one staging firing that writes. (§who.matt, PLAN §13 Cutover 2) | Matt present; build manager creates | Yes (his Mac) | Each task's name and its staging firing result; the old Mac tasks marked disabled |
| 5 | **R2 export and bookmark.** Run the export of every table (§data.export) to R2, then note the live D1 Time Travel bookmark (`wrangler d1 time-travel info`). (PLAN §13 Cutover 3) | Build manager | No (read-only on live data), but tell Matt | The export's object key, its manifest counts and SHA-256, and the bookmark id |
| 6 | **Tag ev4's last live build** and note the ev4 workflow that deploys a tag, for rollback. (`ops/ROLLBACK.md`, "Before the window opens") | Build manager | No | The tag name and workflow name |
| 7 | **Ship to ev-staging.** Merge to main deploys staging; run the end-to-end run on it once more and confirm the parity check passes against the staging export. (PLAN §13 Cutover 4) | Build manager | No | CI run link, end-to-end result |
| 8 | **Ship to ev-live.** Dispatch the live workflow; Matt approves the `live` environment. The deploy itself is ev4's write freeze. (PLAN §13 Cutover 4, §hard.live-on-matts-word) | Build manager dispatches; **Matt approves** | **Yes** | Workflow run link, approval time, deployed commit and version |
| 9 | **Parity against the manifest.** Export live again and compare per-collection counts and SHA-256 with step 5's manifest. Nothing missing or changed. (PLAN §13 Cutover 5, §hard.data-never-lost) | Build manager | No | Per-collection counts and hashes, before and after, in the run record |
| 10 | **Live check.** Boot, read and write one document (see `ops/rollback/verify.sh` for the checks used on rollback), then Matt opens v5 on each device and confirms Today, Library and Ask E.V. load. | Build manager, then Matt | Yes (his confirmation) | Check output (no tokens), Matt's reply |
| 11 | **ev4 service worker retirement.** Confirm v5's page replaces ev4's service worker and cache on each device after the first load, and that ev4's IndexedDB (`ev-app`) is untouched (§data.offline). Stale ev4 pages must not keep serving. | Build manager checks; Matt confirms on devices | Yes (his devices) | Per device: v5 loads fresh, no ev4 worker listed |
| 12 | **Open the rollback window.** Record the window as open in the Chart and update the handover's Live line to the v5 version. The window closes only on Matt's word, after one exam on v5 with no rollback-worthy bug (§deliver.window). | Build manager | Closing: Yes | Chart decision, handover Live line |

v5 keeps its `PlanJob` stub and ships no Durable Object deletion while the window is open (§deliver.window).

## If a step fails

Stop. Do not work around a refused action. If live was already shipped (step 8) and parity (step 9) or the live check (step 10) fails, ask Matt and follow `ops/ROLLBACK.md`: drain jobs, deploy the tagged ev4 build through ev4's own workflow, re-enable ev4's tasks. Rollback is also on Matt's word. Steps 1 to 7 fail safe: ev4 is still live, so fix and retry.

## Run record (fill in at cutover)

| Field | Value |
|---|---|
| Date and time (UTC) | |
| Matt's go-live word (link to comment) | |
| Build manager run / session | |
| v5 commit and version shipped | |
| Last ev4 live build tag | |
| Devices with empty outbox (step 1) | |
| Scratch-check counts and error kinds (step 2) | |
| ev4 cloud tasks disabled (step 3) | |
| Mac tasks re-created and staging firing (step 4) | |
| R2 export key and manifest (step 5) | |
| Time Travel bookmark (step 5) | |
| Staging deploy and end-to-end run (step 7) | |
| Live workflow run and Matt's approval time (step 8) | |
| Parity result per collection (step 9) | |
| Live check and device confirmations (step 10) | |
| ev4 service worker retired, per device (step 11) | |
| Rollback window opened (step 12) | |
| Problems found and what was done | |
| Rolled back? (if yes, link to rollback record) | |
