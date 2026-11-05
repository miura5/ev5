# Cutover checklist and run record

Rules: §deliver.cutover, §hard.live-on-matts-word, §hard.data-never-lost, §hard.ev4-own-process, §who.matt, §data.own-db, §data.export, §data.same-worker. Source: PLAN §8 (scope).

Nothing here starts until Matt says go (§hard.live-on-matts-word). Agents never deploy live: the live deploy runs through the approval-gated `live` environment and only Matt approves it. The build manager walks the list, fills the run record below (copy it into the Chart as a decision when done), and stops at each step marked **Matt**.

There is no rollback to ev4, and v5 starts empty: nothing is copied from ev4 (§data.own-db). v5 never reads or writes ev4's database, buckets or Durable Object (§hard.data-never-lost); they stay as an archive.

## Before the day

- [ ] Gate 6 and Gate 7 are closed in the Chart, the review is done, and Matt has tested on staging.
- [ ] PLAN §8's scope matches or beats ev4 (Matt's word, not the build manager's).
- [ ] Matt has said "go live" on the "For Matt" issue, and has not said "exam week".

## Steps

| # | Step | Who | Needs Matt's word | Proof to record |
|---|---|---|---|---|
| 1 | **Outboxes empty.** Ask Matt to open ev4 on every device he uses and wait until its outbox shows nothing waiting, so ev4's archive holds everything he wrote. | Matt on each device; build manager asks and records | Yes (his devices) | Matt's reply naming each device |
| 2 | **ev4 cloud tasks off.** Disable (mark disabled, never delete) ev4's cloud scheduled tasks, through ev4's own process (§hard.ev4-own-process). List them by name. | Matt, or an ev4 session on his word | Yes (ev4's live tasks) | The list of tasks disabled, with the time |
| 3 | **Mac tasks re-created for v5**, with Matt present, in a session that has the Mac link. Tasks are created, never edited in the desktop app. Prove each with one staging firing that writes. (§who.matt) | Matt present; build manager creates | Yes (his Mac) | Each task's name and its staging firing result; the old Mac tasks marked disabled |
| 4 | **v5's live database.** Create v5's own D1 database and R2 buckets for live (no extra cost on the current plan), and apply the migrations. It starts empty. | Build manager, on Matt's word | Yes (a live resource) | The database name and id, the migrations applied |
| 5 | **Export and bookmark.** Run v5's export of every table to R2 (§data.export) and note the Time Travel bookmark of v5's live database. | Build manager | No | The export key, its manifest, the bookmark id |
| 6 | **Ship to ev-staging.** Merge to main deploys staging; run the end-to-end run on it once more. | Build manager | No | CI run link, end-to-end result |
| 7 | **Ship to ev-live.** Dispatch the live workflow, which binds v5's own database and keeps ev4's `PlanJob` class as a stub (§data.same-worker); Matt approves the `live` environment. | Build manager dispatches; **Matt approves** | **Yes** | Workflow run link, approval time, deployed commit and version |
| 8 | **Live check.** Boot, write and read back one item, then Matt opens v5 on each device and confirms Today, Library and Ask E.V. load. | Build manager, then Matt | Yes (his confirmation) | Check output (no tokens), Matt's reply |
| 9 | **ev4 service worker retirement.** Confirm v5's page replaces ev4's service worker and cache on each device after the first load, and that ev4's IndexedDB (`ev-app`) is untouched (§data.offline). Stale ev4 pages must not keep serving. | Build manager checks; Matt confirms on devices | Yes (his devices) | Per device: v5 loads fresh, no ev4 worker listed |

## If a step fails

Stop. Do not work around a refused action. Steps 1 to 6 fail safe: ev4 is still live, so fix and retry. After step 7, fix forward on staging and ship again on Matt's word; if v5's data is wrong, restore v5's database from a Time Travel bookmark, on Matt's word.

## Run record (fill in at cutover)

| Field | Value |
|---|---|
| Date and time (UTC) | |
| Matt's go-live word (link to comment) | |
| Build manager run / session | |
| v5 commit and version shipped | |
| Devices with empty outbox (step 1) | |
| ev4 cloud tasks disabled (step 2) | |
| Mac tasks re-created and staging firing (step 3) | |
| v5 live database and migrations (step 4) | |
| v5 export key, manifest and bookmark (step 5) | |
| Staging deploy and end-to-end run (step 6) | |
| Live workflow run and Matt's approval time (step 7) | |
| Live check and device confirmations (step 8) | |
| ev4 service worker retired, per device (step 9) | |
| Problems found and what was done | |
