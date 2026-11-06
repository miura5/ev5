# Proposal: v5 on its own database

Status: accepted, 2026-11-05 (v5 on its own database that starts empty, with no rollback to ev4). Its table list is replaced by `table-design.md`, as changed by the accepted table design. History: this file is reference text, never a rule (CONTRACT §drift.one-file).

**Why now.** Matt said on 2026-11-05 that he does not need to go back to ev4 if v5 breaks on switch-over day. The rollback window was the only reason to keep v5 inside ev4's `docs` table, so v5 can keep its record in its own D1 database. ev4's database, buckets and Durable Object stay untouched as an archive. Asked next whether v5 should start with his ev4 notes, sets and weak spots copied in once, or start empty, Matt chose "Start empty". So v5 starts with an empty database and nothing is copied from ev4. A notes-only import can be its own decision later, only if Matt asks.

Evidence and the full study are in the ev-build project folder: `audits/2026-11-05-data-v2/report.md`. Its sections 1-3 (ev4's failures, v5's data path, the needs from PLAN and CONTRACT) hold unchanged. This file replaces its section 6 and adapts section 5 to the new database.

## 1. What the new database fixes

The ev4 format costs below were all checked in the code on 2026-11-05. Each one has a fix in section 2.

| ev4-format cost | Where (checked) | Fix |
|---|---|---|
| Server queries `LIKE`-match JSON text | `server/handlers-session.ts:36`, `server/plan-home.ts:28`, `server/plan-days.ts:56`, `server/jobs-done.ts:107`, `server/handlers-study.ts:47`, `server/excerpts.ts:31` | Real columns with indexes. Search reads a plain-text column. |
| Lookups by bare id, with ids not unique across collections | `server/command-handlers.ts:28` (detects two matches), `:98`; `data/tables/drafts.ts:145` restores an id in every collection | Every id starts with its kind (`note_…`, `set_…`). Every lookup names its table. |
| Appends rewrite a whole document toward the size cap | `talk.messages`, `sessions.events`, `weakspots.events` are maps inside one document (compat schemas) | Appends are rows in their own append-only tables. |
| Pointers are strings in JSON, with no keys or indexes | `exams.planId`, `sets.exam`, `sessions.noteId`; only `docs_at` is indexed (`data/migrations/0000_baseline.sql:10`) | Typed pointer columns with an index. A `(kind, id)` pair only where a pointer can name several kinds. |
| Whole collections go to the browser, with no paging and no deleted filter | `GET /docs?collection=` (`server/doc-routes.ts`) | Reads are per screen or per kind, paged, with deleted rows left out by default. |
| `ALTER` is banned, so every change becomes a side table | `data/migrations/migrations.test.ts:48` | `ADD COLUMN` is allowed. Changes go expand → migrate → contract. |
| Two delete mechanisms | notes carry `archivedAt`/`discardedAt` and also get `deletions` rows | One mechanism: `deleted_at` on the row. |
| Ids that encode their exam | `domain/course/scope.ts:19`, `domain/item/source.ts:45` (`split('-')`) | `objectives.date_id` is a column. |
| Course as a matched name | `domain/course/scope.ts:46`, `domain/course/table.ts:71` (regex) | A course is a collection, picked by id. No name is matched. |
| Copy on first edit of an ev4 set | `domain/own-set/types.ts:17` | Set items carry `v`. An attempt records the item id and version it answered, so an edit never breaks history. |

The study's own findings still apply on the new database:
- **Job output differs from the stored shape** (the practice item has no `id` and a free `sourceRef`, `jobs/practice-set/job.ts:72`; a plan has four shapes).
- **jobs/ writes with its own SQL** (`jobs/runtime/d1-stores.ts:243`).
- **Writes are checked only in tests.**
- **Screens and jobs derive weak spots differently** (`areas/library/map.ts:154` vs `server/plan-home.ts:81`).

## 2. The design

### 2.1 Rules that carry over unchanged
- The write protocol on every table (§data.protocol): `v` bump, `at` from the Worker clock, canonical JSON in JSON columns, version pin with 409, all-or-nothing `batch()`.
- Append-only facts with derived state (§data.append-only). The pure study logic in `domain` (§data.study-logic). Drafts kept, then copied exactly once (§data.drafts). The offline outbox for note saves and answers only (§data.offline).
- The note block format and its proven editor round trip (§data.notes). The size budget (§data.size). The export with counts and SHA-256 per table, and the restore drill (§data.export).
- Only Matt deletes (§delete.who). Recently deleted for 30 days (§ui.delete).

### 2.2 Tables (cutover scope only)
Each table has `id` (kind-prefixed text), `at` (Worker ms), `v`, and, where Matt can delete it, `deleted_at`. JSON columns hold nested bodies only. Nothing below exists for a feature after cutover.

| Table | Holds | Notes |
|---|---|---|
| `collections` | Matt's collections; a course is a collection | `parent_id` (one level, checked in `domain/collection`), `pos`, Canvas course facts as columns (§data.course-facts) |
| `notes` | note title, `body` JSON blocks, `text` (plain text for search, rewritten on each save), `collection_id` | stale saves keep both versions (§data.notes) |
| `sets` | question sets (cards and steps later) | `kind`, `collection_id`, `source_kind`/`source_id`, `date_id` |
| `set_items` | one row per item, `pos`, `type`, `body` JSON, `source_ref`, `v` | one item schema and one scorer, in `domain/item` |
| `attempts` | append-only answers | `set_id`, `item_id`, `item_v`, `correct`, `response` JSON, `source` |
| `objectives` | course objectives, cited | `date_id`, `collection_id`, `source_ref` (§ev.objectives) |
| `weak_spots` | spot, status, source line, `duplicate_of`, `objective_id` | status is derived from events and attempts, never stored as truth |
| `weak_spot_events` | append-only: proposed, confirmed, declined, solid, drilled | replaces the `events` map |
| `dates` | exams and other dates | `kind`, Canvas columns (written only by the sync) and Matt's override columns (written only by Matt); the effective value is a `domain` rule; exam score |
| `plans` | a study plan for a date | `date_id`, `job_id`, `state` (draft, in force, put away) |
| `plan_items` | every line on Today: Matt's own, the morning's, a plan's | `day`, `pos`, `title`, `minutes`, `time`, `origin`, `plan_id`, `linked_kind`/`linked_id`, `repeat_id`, `done_at`; unique `(repeat_id, day)` |
| `repeats` | repeat rules for plan items and dates | rule in `domain/time` (§data.repeat) |
| `sessions` | study sessions, writing minutes | `note_id` or `set_id` |
| `session_events` | append-only session log and E.V.'s session comments | comments belong to the session (§ev.read-along) |
| `talk` | append-only Ask E.V. messages | `cites` JSON |
| `logged_acts` | append-only "just tell me" and the other acts the plan says are logged | `act`, `target_kind`, `target_id` |
| `materials` | Canvas course text used for citations | `collection_id`, `text`; search reads it (§data.search) |
| `pins` | sidebar pins | `target_kind`/`target_id`, `pos`, `v` |
| `drafts` | E.V.'s pending drafts and Today proposals | `job_id`, `target_kind`/`target_id`, `body` JSON, `state` |
| `jobs` | the job record (§job.record) | `kind`, `state`, `cost_cents`, `output_kind`/`output_id`, `reason` |
| `job_state` | a job's interim content between steps | one typed body per job kind |
| `settings`, `ceiling_use`, `ceiling_holds`, `model_usage` | ceilings and usage (§model.ceilings) | carried from today's tables |

**Polymorphic pointers** (`pins`, `drafts`, `plan_items.linked`, `sets.source`) are `(kind, id)` pairs with an index. §data.links holds: each resolves or is reported as an orphan, by the write gate and by the restore drill. There is no generic links table.

### 2.3 One shape per thing (`domain/`)
- Each table has one Zod row schema in `domain/<kind>`. Types, command inputs (`.pick`/`.omit`), wire types and job output schemas are derived from it (§drift.modules).
- A CI test applies the migrations to a scratch SQLite and compares `PRAGMA table_info` with each row schema's keys. The export's column lists come from the same schemas.

### 2.4 One write gate (`data/`)
Every writer uses it: server handlers, job steps, scheduled commands and the outbox. It is the only place with SQL; the server-writes guard covers `server/`, `jobs/` and raw reads.
- **Write:** parse with the row schema → the kind's write rules (who may write which columns, for example Canvas columns only by the sync) → size budget → protocol. A refusal returns its reason; only a stale version returns 409.
- **Read:** parse each row. A bad row is reported and left out, never thrown. Lists are paged and leave out deleted rows unless a read asks for them.
- **Delete and restore:** set or clear `deleted_at`, Matt's caller only (§delete.who). Deleting a collection marks the collection only; its items show ungrouped (§delete.collection).
- Typed functions per kind (`store.notes.save`, `store.attempts.append`, …), generated from the row schemas.

### 2.5 How each caller connects
- **Screens:** through commands and typed reads from the generated client. Outbox writes (note saves, answers) are the named exception on the client, and they pass the same gate on the server.
- **Commands:** one handler per command, typed from the registry, writing through the gate.
- **Jobs:** gather → call → land.
  - Gather: one named domain read per kind, returning only what the prompt uses, plus the excerpt ids.
  - Call: `runStructured`, with the output schema derived from the stored row (the item schema without `id` and `v`), converted by the SDK's own Zod helper.
  - Land: the gate's typed functions, in one batch.
- **Weak-spot state, plan in force and readiness** are domain functions over attempts and events, called the same way by screens and jobs.

### 2.6 Tools, revisited for tables per kind
With real tables, an ORM fits better than it did over one JSON column. The verdict still holds for cutover: **no new dependency.**
- Drizzle is the closest fit, but its stable line is 0.45, 1.0 is still an RC with breaking changes, and its `transaction()` fails on D1 (atomic writes must use `batch()` anyway).
- Its table definitions would be a second schema language beside Zod. PLAN §4 keeps `domain` on Zod only, so Drizzle could not be the source.
- Kysely's D1 dialect is unmaintained and has no batch support. Prisma's D1 support is Preview and silently runs transactions as single queries.
- Hand-written SQL in one folder, behind generated typed functions, plus the `PRAGMA table_info` test, gives one shape source with no new dependency.
- **Revisit after cutover, as its own decision:** Drizzle, once 1.0 is stable and its migration layout works in Wrangler's test pool.

## 3. No import: v5 starts empty
- Matt chose an empty start on 2026-11-05. v5's live database starts with only its migrations applied.
- v5 never reads or writes ev4's database, buckets, Durable Object or IndexedDB. They stay as they are, as an archive. ev4's own export can be taken through ev4's process if Matt wants an extra copy.
- The first boot of v5 no longer offers ev4's unsent outbox notes. Cutover step 1 (every outbox empty) still runs, so ev4's archive holds everything Matt wrote.
- Staging is seeded with synthetic v5 rows written through the gate, never with real data.
- A notes-only import from ev4's export stays possible later, as its own decision, only if Matt asks.

## 4. CONTRACT changes (in this PR; it merges only on Matt's word)

Hard limits:
- **§hard.data-never-lost**, new wording: "Matt's data in v5's D1 database and its backups is never lost: only items he deletes himself are purged, 30 days after his delete (§delete.purge); v5 never reads or writes ev4's database, buckets or Durable Objects, which stay as they are as an archive (§data.own-db)."
- **§hard.ev4-own-process** (kept; the window clause goes): "ev4's repo, live data, resources and tasks change only through ev4's own process, never from v5's build."

Rules that end (to `docs/contract/ended.md`): §data.docs-table, §data.compat, §data.writers, §data.ev4-sets, §data.new-tables, §deliver.window.

Rules added: §data.own-db (own database, one table per kind, starts empty), §data.tables, §data.gate, §data.item-versions.

Rules reworded: §data.additive, §data.same-worker, §data.membership, §data.repeat, §data.migrations, §data.export, §data.search, §data.course-facts, §delete.soft, §delete.purge, §deliver.cutover (no import), §what.framing (a course is a collection), §sec.staging-data (synthetic only), §data.ev4-routes (410 only; the ev4 outbox import ends), §model.output.

Rules kept as they are: §data.protocol, §data.append-only, §data.links, §data.drafts, §data.offline, §data.notes, §data.size.

## 5. Cutover changes

**Simpler:**
- No rollback runbook to ev4, no rehearsal 2, no import and no import dry run.
- No `writer` and `source` rules, no course fallback, no copy on first edit, no repeats copied into `dayedits`, and no overlay collections for Canvas edits.
- About 2,200 to 2,500 lines that exist only for ev4 can go: `data/compat` and its interpreter, two attempt stores, `item_props`, memberships against `course`, `deletions` joins through `json_extract`, and the ev4 outbox import.

**New work:**
- Moving every reader and writer onto the new tables. About 47 non-test files in areas/, server/, data/ and domain/ touch `docs` or ev4 shapes today (about 3,700 lines in areas/, shell/, server/ and jobs/).

**Gates that rerun on the new database:**
- Gate 3 (data): migrations, the gate, export and restore drill.
- Gate 4 (jobs): the landing tests and one real end-to-end run.
- Gate 5 (screens): the e2e journeys and a staging playtest.
- Gate 6 (ops): restore drills, including a Time Travel restore on staging, and one end-to-end run. Rehearsal 2 ends with no replacement.
- Gates 0, 1 and 2 (repo, guards, kit) stand.

**Order:**
1. Matt's yes on the hard-limit wording (this PR).
2. Row schemas.
3. Migrations with the `PRAGMA` test, export and restore.
4. The write gate.
5. In parallel: commands and server, the job runtime, jobs bound to the stored shape.
6. Screens on typed reads.
7. Re-seed staging with synthetic rows through the gate, then rerun Gates 3-6.
8. Retire the ev4-only code, then cutover on Matt's word.

## 6. Cost on the current plan
The account is on the Workers Free plan (the Workflows spike confirmed it).
- **D1:** 7 of the 10 databases the Free plan allows exist now (listed 2026-11-05). `ev5-live` makes 8.
- **Storage:** v5 starts empty, against 500 MB per database and 5 GB per account.
- **Writes:** D1 refuses writes over the daily cap rather than billing.
- **R2:** new buckets are included (the first 100,000), and storage sits inside the 10 GB-month free tier.
- **Total:** no extra cost. Time Travel stays at 7 days on Free.
- Creating `ev5-live` is a live resource, so it happens at cutover on Matt's word.

Sources: https://developers.cloudflare.com/d1/platform/limits/ · https://developers.cloudflare.com/d1/platform/pricing/ · https://developers.cloudflare.com/r2/pricing/
