# ev4 data layer vs. the v5 plan's additive migrations and rollback

Scope: /workspace/ev4 at 9d9af38 (read-only). CHECKED = read in code/record. INFER = my reading. [unconfirmed] = not provable from the repo. [verify] = depends on current vendor docs.

## Verdict up front
- Additive *SQL* changes (new tables, nullable columns on `docs`) are safe for ev4's *writes*: ev4 only ever does `INSERT (c,id,data,at,v)` / `UPDATE SET data,at,v` (worker.js:126-134, runapi.js:248-261). But they are **not backed up** by anything ev4 runs, and they go **stale** whenever ev4 writes during a rollback.
- Additive *JSON* (new fields inside `data`) is **not** safe. ev4 rewrites whole documents, validates against schemas with `additionalProperties:false`, and builds notes from a field allowlist, so v5 fields get stripped or block writes.
- "Replay review history into FSRS" has no per-card source. Flashcards are retired (D-416) and stored only a final SM-2 snapshot. The only per-event history is per *practice item* (answers/) and per *weak spot* (weakspots.events).
- The deletion rule (D-425), the staging copy of live data and the "ev4 read-only" cutover step have **no implementation in ev4**. Each conflicts with a rule or a mechanism in the repo.

## 1. Review history: is it there, and can it be replayed?
CHECKED:
- **answers/<setId>** (spec/schemas/answers.schema.json): `answers: {itemId: {attemptKey: {at, chosen, correct, score, outcome, grade(right|partial|wrong), gradedBy, weakspotId, matched, createdWeakspot, endedAt, text, hits, added}}}`.
  - Append-only (spec.collections.answers.appends); `at` is required on each attempt.
  - Attempt keys are `<writer>-<YYYYMMDD-HHMMSS[mmm]>[-sfx]` (schema propertyNames; core/evcore.mjs:288 eventKey; page uses `eventKey('page', at)` at evcore.mjs:852).
  - This is a real per-item ordered event log with a timestamp and a binary or 3-level outcome.
- **sets/<id>**: "items never change once written" (sets.schema.json $comment). Item ids are *set-local* (synthetic data: `d1`, `w1`; test/data/synthetic.cjs). So an item's identity is `setId+itemId`, and an item is normally answered in one sitting, never re-presented on a schedule.
- **Scheduling in ev4 is per weak spot, not per item.** core/evcore.mjs:600-780 derives `streak`/`nextDue`/`recurrence` from answers plus `weakspots.events` (park/activate/solid/reopen/snooze…; weakspots.schema.json). The parameters are `spec.study` (`scheduler: "fixed"`, `params {base 3, cap 14, nearExam 1}`). Answers link to a spot through `weakspotId` on the item or the attempt.
- **decks/** (flashcards, D-368, Oct 29) store only SM-2 *state* per card (`state, due, ivl, ease, reps, lapses, last, lastAt`; decks.schema.json). There is no per-review log.
  - Retired Oct 31 (D-416: "Matt keeps them in Quizlet"; spec.collections.decks.retired=true; core/steps-worker.mjs:38).
  - Whether any live decks exist is [unconfirmed].
- Quizlet is read-only text from its home page on Saturdays (spec.boundaries B-17). No Quizlet review history enters E.V.

INFER, what a replay gets wrong:
- (a) Replaying per item gives thousands of one-review "cards". FSRS only means something per *weak spot* (or per objective), using attempts grouped by `weakspotId`.
- (b) Outcomes are correct/incorrect (single/sata/matrix/numeric) or right/partial/wrong (open). They map to Again/Good at most; Hard/Easy cannot be recovered. `score` (0-1) exists but isn't a rating.
- (c) Multiple choice and recall attempts get mixed in one stream. FSRS assumes recall.
- (d) Weak-spot Join (`links` duplicate-of) and park/snooze/decline events change which spot owns which history. The replay must apply ev4's own derivation rules, or it diverges from what Matt saw.
- (e) v3-era attempts were re-keyed with `at` reconstructed (core/migrate.mjs:69-84 rekey). Pre-Oct-18 timestamps may be approximate [unconfirmed].
- (f) Flashcards can only be *seeded* approximately from the SM-2 snapshot (`ivl/ease/reps/lapses/lastAt`), not replayed. Whether ts-fsrs has an SM-2 import is [verify].
- (g) Item ids do not change. Ids are stable keys and items are immutable, so "edited after review" is not a risk for sets.

## 2. Real D1 model and every write path
CHECKED:
- Tables are listed in pwa/schema.sql:1-45: `docs(c,id,data,at,v)`, PK(c,id), index on `at`, plus `claude_usage`, `claude_reads`, `claude_settings`, `claude_plan_asks`, `system_docs`.
  - Collections map to the `c` value. Sub-collection paths are allowed (`validCollection`: odd segment count up to 15, runapi.js:28-35). The restore drill uses `drills/<run>/<c>`.
- `v` is a per-document optimistic-concurrency counter: 1 on create, +1 on every write from every path (worker.js:7-10, 124-135; runapi.js:236-262).
  - Page PUT: `if_version` absent means create-only (`ON CONFLICT DO NOTHING`); present means `UPDATE … WHERE v=?`. Otherwise 409.
  - Batch: per-row version guard via `json('changed')` failing inside one `DB.batch` transaction (runapi.js:241-245).
- `at` is the Worker clock in ms. It drives the page's incremental sync `GET /api/db?since` with a 5 s overlap (worker.js:79-88).
  - The page ignores any row whose `v` is lower than the one it cached (bridge.js:298).
  - **v5 must bump `v` and set `at` on every write, and must never recreate an id at a lower v**, or ev4 clients overwrite or miss its changes.
- Writes are whole-document.
  - Page `set` sends what the page built. Page `update` merges client-side into its cached copy, then PUTs the whole document (bridge.js:397-414, 980-1020).
  - Run API `update` deep-merges server-side; `{"__delete__":true}` removes a field (runapi.js:70-79).
  - Every stored body is canonical `JSON.stringify` (B-398, runapi.js:41-68), so Mac and R2 hashes match.
- Id shapes are per collection (`spec.collections.<c>.key`):
  - notes: `n-<UTC>-<16 random>` (bridge.js:573-576)
  - generic `add()`: `'x'+random` (bridge.js:1031-1032)
  - weak spots: `ws-<date>-<objective>-<slug>`
  - sets: `job-<YYYYMMDD-HHMMSS>-<slug>`
  - answers: the set id
  - append-map keys: `<writer>-<time>`

Write paths:

| # | Writer | Where |
|---|---|---|
| 1 | Page save | `PUT /api/db/<c>/<id>`, worker.js:95-154 (notes also validated, worker.js:115-122 → pwa/notes.js:13-16) |
| 2 | Run API batch, 1-50 writes | runapi.js:209-273 |
| 3 | Callers of #2: page job runner | bridge.js:939-952 |
| 3 | Callers of #2: PlanJob Durable Object | planjob.js:62-77 (reads the whole `docs` at :51) |
| 3 | Callers of #2: scheduled pipelines | core/runapi-client.mjs:160-167 (morning 4:25, evening-cloud, evening-mac Canvas sync, weekly, worker, watchdog 8×/day, restore-drill; spec.tasks.live, spec.registry.records.live.runs.pipelines) |
| 3 | Callers of #2: one-time copy | tools/pwa-copy.mjs |
| 4 | claude_* tables | claude.js:192, 199-200, 251-253, 323-324, 423-424, 477 |
| 5 | system_docs (deploy workflow PUT) | system.js:30-40 |
| 6 | Durable Object's own storage (not D1) | planjob.js:248-256 |
| 7 | Workflow SQL: schema.sql on every live deploy | pwa-live.yml:108 |
| 7 | Workflow SQL: staging seed/fill and `ALTER TABLE docs ADD COLUMN v` | pwa-staging.yml:120-141 |
| 7 | Workflow SQL: scratch D1s | pwa-live.yml:178, pwa-staging.yml:244, 304 |
| 8 | Cron `scheduled()`: reads D1, writes R2 only | worker.js:35-37 → backup.js:338-352 |
| 9 | Note images in R2 (`EXPORTS` bucket, `note-images/`) | images.js:1-45 |

There is no DELETE anywhere. Delete ops and HTTP DELETE are refused (runapi.js:90, 169-170).

## 3. Is "additive" meaningful here? What breaks ev4
CHECKED:
- Validator: `additionalProperties:false` emits "unknown field" (core/validate.mjs:148-150). An unknown collection is an error (validate.mjs:227-229).
  - Top-level `additionalProperties:false` on answers, notes, days, dayedits, jobresults, talk, planedits, settings, runs, examedits, predictions, materialedits, decks, concepts, debug.
  - Nested `false` on sets items, weakspots links/initial, sessions, weeks, system.
- Where validation runs:
  - Page `write()` validates every `set` against the full registry (page/app/04-model.js:62-71). Notes are checked on set *and* update (04-model.js:49-58).
  - The Worker checks notes on every PUT and batch (worker.js:115-122; runapi.js:137).
  - Every run validates the *merged* result of each update (core/run.mjs:528, 550), so one invalid document refuses the whole run plan.
  - Nightly lint flags invalid documents and warns `unknown-collection` (core/lint.mjs:153-156, 193-194). This is informational (state.lint, steps.mjs:150).
- **Notes are rebuilt from an allowlist** on every ev4 save (core/notes.mjs:948-964: schema 1, writer, at, source, createdAt, title, course, blocks, editedAt, label, earlierOf, archivedAt, discardedAt). Then `set` (page/app/25-notes.js:2005).
  - **Any v5 field on a note is dropped the next time ev4 saves it**, and `schema` is forced back to 1.
  - A v5 block type outside the enum makes the note unsavable in ev4.
- core/migrate.mjs bumps are **not applied on read**. They run only through `cli migrate bumps` (core/cli.mjs:175) and the seed (core/seed.mjs:29, 103).
  - They spread `...d`, so they don't strip fields. A v5 `schema` number above ev4's `const` fails ev4 validation instead.
- What iterates over all rows:
  - `GET /api/db` returns every row of `docs` and `JSON.parse`s each one with no guard (worker.js:82-86). One non-JSON row means a 500 for every ev4 boot.
  - The page caches everything in IndexedDB (bridge.js:94-118).
  - The run API list also parses without a guard (runapi.js:164). planjob loadDb guards each row (planjob.js:53-56).
  - A big v5 collection inside `docs` (for example review_log as documents) is downloaded by every ev4 client at boot and read by every PlanJob.
- INFER, the per-option effect on ev4:
  - New fields in existing JSON: stripped (notes and any page `set`), or the run refuses (fields on days/weakspots/sessions docs the morning/evening/filing runs update).
  - New collections inside `docs`: harmless to writes; lint warnings; downloaded by clients.
  - New tables or new nullable columns: invisible to ev4. **Safest**, but see §4 and §6.
- FTS5 with triggers on `docs`:
  - Every ev4 path stores valid JSON (canonicalJson). Invalid JSON is not the risk.
  - The risk is that *any* trigger error aborts ev4's write. The Run API reports *every* batch exception as a version conflict, "a document changed … read again and resend" 409 (runapi.js:264-271), so runs and the page would retry or misreport instead of surfacing the trigger bug.
  - Cloudflare's docs say D1 supports FTS5 virtual tables but "Export is not supported for virtual tables, including databases with virtual tables" (developers.cloudflare.com/d1/best-practices/import-export-data/). One open report says a failed export left the database inaccessible (cloudflare/workers-sdk#9519). A late-Oct-2026 docs changelog PR describes a new compatibility export whose dump "cannot be imported back into D1" (cloudflare/cloudflare-docs#34586). [verify] current status.
  - ev4's own exports use SELECTs, not `wrangler d1 export`, so they keep working. Any v5 or staging-copy plan built on `d1 export` breaks once FTS exists.

## 4. Backups and restore
CHECKED:
- **R2 nightly**: the Worker cron `17 8 * * *` UTC on ev-live, bound by pwa-live.yml:122.
  - `exportToR2` does `SELECT c,id,data,at,v FROM docs`, minus per-target system docs, and writes `exports/<day>/<time>.json` with a per-collection count+SHA-256 manifest (backup.js:338-352).
  - Exports are never overwritten (backup.js:326-335). The same bucket holds note images.
- **Mac nightly**: the evening-mac run (Mac lane) dumps D1 through `/api/run/collections` plus `list` (core/d1backup.mjs:33-56 → steps.mjs:654-680) into the backup folder named in spec.registry.records.live.runs.backup.
- **Time Travel**: "on" per D-302/B-316, but checked only for staging (`time-travel info`, pwa-staging.yml:224). Live is [unconfirmed]. Retention is [verify].
- nightly.yml is a UI test run, not a backup.
- **Restore has only ever been drilled into scratch.** Staging: B-22 (515 docs), B-163, B-316 (R2 → `restore_<run>` table, tools/pwa-backup.mjs:27-37). Live: B-424, "restore drill on v4.5.11 passed (703 documents)" into ev-live-scratch under `drills/<run>/<c>` (steps.mjs:593-637).
  - No tool or procedure restores into the live `docs` table. D-091's "restore into live … from a build chat" predates D1.
  - A Time Travel restore has never been run. Search: no `time-travel restore` anywhere.
- **New tables and new columns are silently missed** by both backups (fixed SELECT column list at backup.js:340; the Mac dump goes through the docs-only run API).
  - restoreSql recreates only the 5-column table (pwa-backup.mjs:29-31). System_docs and claude_* tables are not backed up today either.
  - Note images live only in R2 (images.js:1-5) and are never in the Mac copy.

## 5. Deletes and purge
CHECKED:
- **Not implemented in ev4.** B-422 ("Delete with a 30-day trash", D-345) is open, and B-686 (Recently deleted, D-425) is open and waiting on Matt. There is no `deletedAt`/trash field in any schema, and no delete in any code path.
- The hard-limit text is still "Nothing is deleted anywhere (records…)" (CLAUDE.md:54-55; spec.boundaries B-11 "never delete anything"). B-686 notes say the wording is "guarded" and changes with the release.
- D-345 wants the purge "cleared by the Worker", with "runs and agents get no delete path".

INFER:
- ev4 has no tombstones. The since-sync never tells a client that a row vanished. A purged row stays in every ev4 device's IndexedDB copy and stays visible there.
- **ev4's notes outbox resurrects purged notes**: a stale save → `run/get` 404 → `o.base = null` → re-sent as a create (bridge.js:687-692).
- A v5 soft-delete field on an existing doc is ignored by ev4 (the item shows again), and dropped on ev4's next note save (allowlist), which un-deletes it.
- Purged documents survive in every R2 export and Mac backup forever ("never overwritten or deleted", D-302). "Permanent deletion" holds only for the live D1 and Time Travel's window [verify].
- Two purgers can't both exist, because ev4 has none. The real conflict is v5 deletes against ev4 clients/outbox during overlap or rollback.

## 6. Rollback
CHECKED:
- .claude/skills/rollback/SKILL.md rolls back **code only**: page, system/manifest/spec/environments and task prompts. The record "keeps everything it holds" (lines 14-15, 25-26).
  - Mechanism: a restore commit on ev4 `main`, then `ship staging`, then `ship live` → pwa-live.yml redeploys the **ev-live** Worker from ev4's pwa/ and re-runs schema.sql (pwa-live.yml:100-123).
- `rollbackTarget` takes the target from ev4's chart/deploys.json and refuses the current last live commit (`d.commit !== from.commit`, tools/chart.mjs:2313-2327).
  - The last ev4 live build is 56c8acb (v4.5.32, rollback field 8397e37).
  - Unless v5 deploys are recorded there, `rollback live` goes back to the build *before* the last ev4 build, and cannot target the last ev4 build itself.
- B-460 (declined): an ev4 redeploy over a Worker whose Durable Object classes or migrations differ can be refused by Cloudflare. That applies here if v5 changes DO classes [verify].
- SKILL.md:27-29 and chart.mjs:2445 still say "the staging record is seeded from live", which is stale (B-311).

INFER, what goes wrong going back and then forward again:
- ev4 sees v5 JSON fields (and strips them on its saves), v5 collections in `docs` (downloaded, ignored), and none of v5's tables or columns.
- ev4 writes during the rollback period:
  - New answer attempts and weak-spot events are *not* in review_log or the FSRS columns. v5 must re-derive them on return, which is feasible because attempt keys are unique and append-only (§1).
  - New and edited docs leave the nullable columns NULL or stale. Notes lose v5 fields. Purged notes can come back through the outbox. FTS stays correct only if it is trigger-maintained.
- Device state:
  - ev4's service worker reclaims the same origin (sw.js), and IndexedDB `ev-app` opens at version 2 (bridge.js:70).
  - If v5 upgrades that IDB name, ev4 gets a VersionError and loses its offline copy and outbox. v5 should use a separate IDB name.
- The ev4 scheduled pipelines resume writing only if their tasks are re-enabled. Mac tasks are re-created only with Matt present (CLAUDE.md:77-79).

## 7. Staging data
CHECKED:
- No D1→D1 copy exists. tools/pwa-copy.mjs copies a *claude.ai artifact* into a D1, once (header lines 1-25).
- `seed-staging` (core/seed.mjs:1-5) targets the claude.ai staging artifact.
- The staging D1 is "seeded with the made-up record only" (B-311; wrangler.toml:16-18; pwa-staging.yml:1-5).
- The staging deploy check goes **RED** for any document not from the seed or a known staging writer (tools/pwa-staging.mjs:1-11, 187-225). A live copy fails `ship staging`, which gates live (R-02).
- The only live data outside ev-live today is ev-live-scratch: drill copies under `drills/<run>/…`, created by pwa-live.yml:170-181 with the live token.
- Rules in play:
  - "Personal data never enters this repository" (CLAUDE.md:57). Not literally violated by a staging D1.
  - Staging is where agents work freely: "Nothing at staging waits on Matt" (CLAUDE.md:28-29), cold UX testers, builders, and cloud sessions that reach staging (B-311 DoD).
  - The staging token lives in repository Actions secrets (wrangler.toml:16-18). D-320 says the staging record is "test data only".
  - D-091 (Oct 18, claude.ai era) did seed staging from the live backup (journal excluded, D-335). It is the only precedent and was overtaken by B-311.

INFER: "staging uses a copy of the live data" puts Matt's notes and journal in front of every build agent and a repo-held token. That is a **large decision for Matt** under CLAUDE.md:24 ("what personal data E.V. keeps"), not a staging detail. A synthetic or ev-live-scratch-style restricted copy avoids it.

## 8. D1 failure and offline today
CHECKED:
- Worker: no try/catch around D1 in worker.js. A D1 error becomes an uncaught 500. In a batch, any D1 exception is reported as a 409 conflict (runapi.js:264-271).
- Page boot: reads the IndexedDB copy first. If the pull fails, it runs from the copy, read-only except notes (bridge.js:359-374). It polls every 10 s and on focus/online/visible (bridge.js:383-394).
- Notes offline: kept in an IndexedDB outbox per tab, replayed pinned to `base`. 429/5xx retry with backoff doubling 2 s → 60 s (bridge.js:595-603, 654). A stale save keeps both versions as an "(earlier)" note (D-326, bridge.js:687+).
- All other writes offline are refused with `e.unsaved` (bridge.js:423, 515-521). A 409 re-pulls and retries once for update/create-merge (bridge.js:428-447).
- The UI paints first, then on refusal unpaints and toasts "Couldn't save" (04-model.js:73-80, 95-113).
- The service worker caches the shell only and never /api (sw.js:1-6).

## Conflicts with the plan
1. **Plan: "ev4 becomes read-only before v5 writes".** ev4 has no read-only switch for the app. READ_ONLY is explicitly skipped when `host === 'ev-app'` (04-model.js:35-36). The Worker accepts every PUT and batch. Seven scheduled pipelines write live D1 (spec.tasks.live), and the Mac tasks need Matt present to change. Open tabs and the notes outbox keep writing. **Blocker** until a Worker-level write freeze and a task-disable step exist.
2. **Plan: "card state in additive columns; replay review history".** There are no active cards (D-416). Decks hold only an SM-2 snapshot. Per-event history exists per item and weak spot (answers, events) but has binary or 3-level outcomes. answers.schema.json, decks.schema.json, evcore.mjs:600-780. **High**: decide what a v5 "card" is first.
3. **Plan: "additive only so ev4 can still run" (if read as new JSON fields).** ev4 strips fields (core/notes.mjs:948-964), refuses runs (run.mjs:528-551), and rejects notes (pwa/notes.js:13-16). **High.** Only new tables and columns are additive in practice.
4. **Plan: "same backups and nightly export".** Both exports dump only `docs` (backup.js:340; d1backup.mjs:33-56). review_log, the FSRS columns and the FTS index would have no backup. An FTS table also blocks `wrangler d1 export` [verify]. **High.**
5. **Plan: "staging Worker uses a copy of the live data".** No mechanism exists. B-311 says synthetic only. pwa-staging.mjs goes RED on a copy. Personal data would reach agents. **High** (a Matt decision).
6. **Plan: "ev4 rollback window" using the rollback skill.** The skill is code-only, ev4-repo-only, and cannot target the last ev4 build (chart.mjs:2313-2327). DO compatibility is unaddressed (B-460). **Medium.**
7. **Plan: deletion rule D-425, "purged after 30 days".** Not built (B-422/B-686 open). The hard-limit text still says nothing is deleted (CLAUDE.md:54). ev4 clients have no tombstones and the outbox resurrects deleted notes (bridge.js:687-692). Backups keep purged data forever. **Medium** (high during any ev4/v5 overlap).
8. **Plan: restore confidence (implied by "same backups").** Restores were only ever drilled into scratch. No restore into live D1 or Time Travel restore has been rehearsed, and Time Travel on live is [unconfirmed]. **Medium.**
9. **v5 writes must keep ev4's `v`/`at` semantics and canonical JSON** (worker.js:79-88, 124-135; bridge.js:298; runapi.js:41-68). Otherwise ev4 loses updates or misses changes and backup hashes diverge. **Medium.**
10. **FTS triggers on `docs`.** A trigger failure blocks ev4 writes and shows up as a false 409 (runapi.js:264-271). **Low/medium.** Prefer app-maintained or rebuildable FTS outside ev4's write transaction, or keep the triggers trivially safe.

## Holds up
- Same Worker and D1 with **new tables or nullable columns**: ev4's SQL never touches unknown columns or tables, and `CREATE TABLE IF NOT EXISTS` in schema.sql won't disturb them.
- "Small typed repositories with Zod over the existing schema" fits: one generic `docs` table, an envelope (schema, writer, at, source) and per-collection JSON Schemas already exist to port.
- Seeding from history is possible for weak spots. The attempts are append-only, time-stamped, uniquely keyed and immutable-item, so a replay is deterministic and can be re-run after a rollback.
- Exports are never overwritten, and per-collection SHA-256 manifests give a ready-made parity check for a v5 cutover.
