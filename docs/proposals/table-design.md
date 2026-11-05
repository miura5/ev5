# Proposal: one table per stored kind

Status: proposed, 2026-11-05. The build manager reviews this file and records a Chart decision before the row-shapes task, the migration task and the kind tasks start. This file is reference text, never a rule (CONTRACT §drift.one-file). It builds on `fresh-database.md` (v5's own D1, starts empty) and fills in what that file left as a list: columns, ids, pointers, indexes, the migration, the export, and the order of work.

Ported ev4 document shapes are reference only (the earlier decision on ported shapes). Where a row below differs from today's `domain/` document schema, the row wins and the document schema goes when its kind moves.

## 1. Conventions for every table (§data.tables, §data.protocol)

- **Id:** `TEXT PRIMARY KEY`, kind prefix plus a time-sortable random suffix made by the Worker (or by the client for outbox writes, see `attempts`). A `CHECK (substr(id, 1, N) = 'goal_')` in the migration makes the prefix a database fact. Prefixes: `col_` collections, `goal_`, `obj_`, `link_`, `att_`, `ws_` weak spots, `wse_` weak-spot events, `set_`, `item_`, `ses_`, `sese_` session events, `note_`, `plan_`, `pli_` plan items, `rep_` repeats, `talk_`, `file_`, `mat_` materials, `pin_`, `draft_`, `job_`.
- **`at`** INTEGER ms from the Worker clock, **`v`** INTEGER from 1, on every table. Append-only tables write `v = 1` and never change a row, but still carry both so the gate, export and PRAGMA test treat all tables alike.
- **`deleted_at`** INTEGER NULL on every table Matt can delete (marked "del" below); no other table has it. Setting it is the one delete mechanism (§delete.soft). Reads leave deleted rows out unless asked; Recently deleted reads `deleted_at IS NOT NULL`; the 30-day purge (§delete.purge) removes the row and its append-only children in one batch.
- **Pointers:** a typed column named for its target (`collection_id`, `objective_id`) with an index. A `(kind, id)` pair only where one pointer can name several kinds, always indexed, always checked by the gate on write and by the drill as an orphan report (§data.links).
- **JSON columns** hold nested bodies only (canonical JSON, §data.protocol), each with a size budget in the gate (§data.size). Anything queried is a column.
- **Derived state is never stored** (§data.append-only): weak-spot state, due dates, streaks, readiness, plan in force by date, the effective date of a goal are `domain` functions over rows.
- **One row schema per table** in `domain/<kind>` (Zod). The migration, the PRAGMA test, the gate's typed functions and the export column lists all come from it. The ev4 envelope fields (`schema`, `writer`, `source` strings) do not exist on rows; who wrote a row is `by` where it matters.

## 2. The tables

Types: `T` text, `I` integer, `R` real, `J` JSON text. `?` means NULL allowed. Every row also has `at`, `v` and, where marked del, `deleted_at`; they are not repeated.

### 2.1 collections (exists; `ADD COLUMN` in the new migration), del

`id col_`, `title T`, `parent_id T?` -> collections (one level, checked in `domain/collection`, §data.membership), `pos R`, `canvas_id T?`, `status T` (`active` | `done`, default `active`), `class_days J?` (weekdays), `exam_kinds J?`. The last four are the course facts (§data.course-facts): a course is a collection with a `canvas_id`; no course is named in code. Index: `parent_id` (exists), unique `canvas_id` where not null.
`memberships` goes: an item's collection is its own `collection_id` (§data.membership).

### 2.2 goals (replaces `exams`, hand-made dates, `dateedits`, `examedits`), del

An exam is one kind of goal. Kinds are data: `kind T` is a free label ("midterm", "quiz", "finish chapter 4"); no list in code.
`id goal_`, `collection_id T?`, `title T`, `kind T`, `date T?` (YYYY-MM-DD, Matt's value; the date is optional), `status T` (`open` | `done`), `score R?` (0 to 1, set when done), `canvas_id T?`, `canvas_title T?`, `canvas_date T?`, `created_by T` (`matt` | `canvas` | `ev`).

- Canvas columns are written only by the sync (a write rule in the gate); `title`, `date`, `status`, `score` only by Matt's commands. A Canvas-created goal copies `canvas_title` into `title` and `canvas_date` into `date` at creation; a later sync changes only the `canvas_*` columns, and `domain/goal.effective(goal)` shows Matt's value when he set one and otherwise the Canvas one, with a flag when they differ. This is what `dateedits` and `examedits` did, with no side document.
- Indexes: `(collection_id)`, `(date)`, unique `(canvas_id)` where not null.
- A goal does not point at its plan, objectives or material: plans point at goals (2.9) and links join the rest (2.4).

### 2.3 objectives, del

`id obj_`, `collection_id T`, `num I?`, `text T`, `chapters J?`, `source_ref J?` (the citation, §ev.objectives), `created_by T`.
No exam id, and the id never encodes an exam (today's `split('-')` goes). Which goal an objective belongs to is a link row. Index: `(collection_id, num)`.

### 2.4 links (the one many-to-many table), del

`id link_`, `from_kind T`, `from_id T`, `to_kind T`, `to_id T`, `by T` (`matt` | `ev`), `note T?`.

- A link points at a goal or an objective: `to_kind` is `goal` or `objective`. Allowed rows, checked in `domain/link` and by the gate: goal -> material (`from_kind` in `note`, `set`, `material`, `file`, `to_kind` = `goal`); objective -> goal (`from_kind` = `objective`, `to_kind` = `goal`); material -> objective (`from_kind` in the material kinds, `to_kind` = `objective`). Reading it in Matt's words: "this note is for that exam", "this objective is on that exam", "this note covers that objective".
- Unique `(from_kind, from_id, to_kind, to_id)` where `deleted_at IS NULL`. Indexes `(to_kind, to_id)` and `(from_kind, from_id)`.
- Both ends must resolve on write; a deleted end keeps the link, which is reported as an orphan by the drill only when the end is purged or missing, not when it is merely deleted.
- The weak spot's own `links` array goes. A duplicate is `weak_spots.duplicate_of`; nothing else used it (open choice 1 below).

### 2.5 attempts (one append-only table for every kind of practice)

`id att_`, `item_id T` -> set_items, `item_v I`, `set_id T`, `session_id T?` -> sessions, `source T` (`run` Library study run, `session` check-in in a note session, `note` question inside a note, `ask` Ask E.V.), `how T` (`chose` | `typed` | `steps` | `told` "just tell me" | `skipped`), `answer J?` (what was chosen or typed), `score R?` (0 to 1, or NULL when ungraded: told, skipped, open answers not yet read), `answered_at I` (the device clock, for ordering offline answers; `at` stays the Worker's).

- **No `deleted_at`, no update.** A row is only ever inserted. A deleted set or item hides its attempts from derived reads, and the purge removes them with it.
- **Every question has an item.** A question asked in a note, in a session check-in or in Ask E.V. is first written as a `set_items` row in an auto-made set of kind `adhoc` (one per note or per chat, `source_kind`/`source_id` naming it), in the same batch as the attempt. So `(item_id, item_v)` always resolves and §data.item-versions holds for every source with one scorer in `domain/item`.
- **Idempotent for the outbox:** the client makes the attempt id (`att_` + its ULID); the gate inserts it once and answers a repeat of the same id and body as success, a different body under the same id as a refusal with its reason (never 409). A refused answer comes back to the outbox, which shows it.
- Indexes: `(item_id, at)`, `(set_id, at)`, `(session_id)`, `(at)`.

### 2.6 weak_spots, del; weak_spot_events (append-only)

`weak_spots`: `id ws_`, `collection_id T?`, `objective_id T?` -> objectives, `topic T`, `kind T` (the existing `WEAK_SPOT_KINDS`), `words T?`, `source_line T` (where it came from), `duplicate_of T?` -> weak*spots, `proposed I` (0/1), `created_by T`, `pre_read I`, `reading_due T?`, and the old `initial` block as columns `init_streak I?`, `init_next_due T?`, `init_recurrence I?`, `init_misses I?` (they feed the fixed-interval scheduler, §data.study-logic). No exam or course pointer: the goal is reached through the objective's links. Indexes `(objective_id)`, `(collection_id)`, `(duplicate_of)`.
`weak_spot_events`: `id wse*`, `weak_spot_id T`, `type T`(proposed, confirmed, declined, solid, drilled, snooze, ...: today's`EVENT_TYPES`), `by T`, `note T?`, `objective_id T?`, `until T?`(snooze date; required for`snooze`), `at`, `v`. Index `(weak_spot_id, at)`. Two quick taps are two inserts; there is no whole-document write to race. State is `domain/weak-spot` over events plus attempts (the due-read task).

### 2.7 sets and set_items, del; set_item_versions (append-only)

`sets`: `id set_`, `collection_id T?`, `kind T` (the existing `SET_KINDS` plus `adhoc`), `title T?`, `source_kind T?`, `source_id T?` (a pair: note, material, weak*spot, goal, objective), `created_by T` (`matt` | `ev`), `job_id T?`, `focus J?`, `asked I?`. One table for own sets and E.V.'s sets; copy-on-first-edit goes. Which goal a set is for is a link row. Indexes `(collection_id)`, `(source_kind, source_id)`.
`set_items`: `id item*`, `set*id T`, `pos R`, `type T` (`ITEM_TYPES`), `body J`(stem, options, correct, rationales, matrix, steps, keywords: the item schema without`id`), `objective_id T?`, `weak_spot_id T?`, `source_ref J?` (`{kind, id, span?}`, kind only one that has a table), `v`(bumps on every edit of`body`). Indexes `(set_id, pos)`, `(objective_id)`, `(weak_spot_id)`.
`set_item_versions`: `id`=`item_id`+`@`+`v`(prefix`item*`), `item_id T`, `item_v I`, `body J`, `at`. Written in the same batch as an edit that changes `body`(the version being replaced). Settles open choice 2: attempts keep only`(item_id, item_v)`, and "what did I answer" is rebuilt from this table. Unique `(item_id, item_v)`.

### 2.8 sessions, del; session_events (append-only)

`sessions`: `id ses_`, `kind T` (`note` | `skill`), `note_id T?`, `set_id T?`, `collection_id T?`, `day T` (YYYY-MM-DD, Central), `status T` (the existing `STATUSES`), `planned_min I?`, `started_at I?`, `ended_at I?`, `topic T?`, `clock T?` (`writing`), `minutes I?` (the settled writing time, §data.writing-time), `driver J?` (which view drives the session; `{view, at}`). Indexes `(note_id)`, `(day)`, `(status)`.
`session_events`: `id sese_`, `session_id T`, `type T` (existing `EVENT_TYPES`: start, pause, resume, mark, miss, switch...), `body J?` (len, h, n, result, format, items, view, why...), `at`, `v`. Index `(session_id, at)`. E.V.'s comments and check-in lines are not session events; they are talk rows (2.11).

### 2.9 plans, plan_items, repeats

`plans` (del): `id plan_`, `goal_id T` -> goals, `job_id T?`, `state T` (`draft` | `in_force` | `put_away`), `title T?`, `from_day T`, `to_day T`, `summary T?`. A partial unique index on `(goal_id)` where `state = 'in_force'` allows at most one plan in force per goal. `planedits` goes: approve sets `state` (the old plan in force goes to `put_away` in the same batch); put-away sets it. Indexes `(goal_id)`, `(job_id)`.
`plan_items` (del): `id pli_`, `plan_id T?` -> plans, `day T`, `pos R`, `title T`, `minutes I?`, `time T?`, `origin T` (`matt` | `morning` | `plan`), `linked_kind T?`, `linked_id T?` (note, set, weak*spot, goal, objective), `repeat_id T?` -> repeats, `done_at I?`. Unique `(repeat_id, day)` where `repeat_id IS NOT NULL` (§data.repeat). Indexes `(day)`, `(plan_id)`, `(linked_kind, linked_id)`. `dayedits` goes completely: its `added` entries are rows with origin `matt`, its ticks are `done_at`, its removals are `deleted_at`. `item_props` goes with it (time, repeat and linked are columns now).
`repeats` (del): `id rep*`, `title T`, `minutes I?`, `time T?`, `rule J`(written by`domain/time`, no recurrence library), `from_day T`, `to_day T?`, `linked_kind T?`, `linked_id T?`. The morning makes each day's `plan_items` row once.

### 2.10 notes, del

`id note_`, `collection_id T?`, `title T`, `body J` (ev4 block format, §data.notes), `text T` (plain text rewritten on every save; the only column search reads, §data.search), `earlier_of T?` -> notes (a stale save keeps both versions: the one not kept is a new row titled "(earlier)" pointing at the kept one). Indexes `(collection_id)`, `(earlier_of)`, `(at)`. The body keeps the 262,144-byte budget in `domain/note`.

### 2.11 talk (append-only)

`id talk_`, `chat_id T` (the Ask E.V. conversation, or the session id for check-in lines), `scope T` (`ask` | `session`), `session_id T?`, `context_kind T?`, `context_id T?` (the note or set Matt was on), `role T` (`matt` | `ev`), `text T`, `cites J?`, `job_id T?`. No update, no delete column; the purge removes a chat's rows only with the session it belongs to. Indexes `(chat_id, at)`, `(session_id)`.
A reload reads the chat by `chat_id`; Ask E.V. sends the stored rows up to a cap by count or tokens, no summarising (the talk move). A new Ask chat is a new `chat_id` (open choice 3).

### 2.12 files (note pictures only, the note-pictures task), del

`id file_`, `kind T` (`note_image`), `type T` (MIME), `size I`, `sha256 T`, `r2_key T`, `owner_kind T`, `owner_id T` (the note). Unique `r2_key`; index `(owner_kind, owner_id)`. Nothing for PDFs, slides or pages yet.

### 2.13 materials (Canvas course text for citations), del

`id mat_`, `collection_id T`, `canvas_id T?`, `title T`, `text T` (search reads it), `url T?`. Index `(collection_id)`. This is the "material" a note, set or goal can be linked from.

### 2.14 Kept as they are (an id-prefix and `v` pass only)

`pins` (`pin_`, `target_kind`, `target_id`, `pos`, `v`; del), `drafts` (exists; `target_c` becomes `target_kind`), `job_records` and `job_plans` (the job record and its interim content), `ceiling_use`, `ceiling_holds`, `ceiling_usage`, and a new `model_usage` if the row-shapes task finds the ceilings still need one. `settings` (`key T PRIMARY KEY`, `value I`, `at`, `v`) replaces `claude_settings` and gains `v`.

### 2.15 Left out of v5

`docs`, `deletions`, `memberships`, `item_props`, `own_sets`, `own_set_items`, `own_attempts`, `system_docs` (ev4's per-target system documents), and ev4's `claude_usage`, `claude_reads`, `claude_plan_asks`. Nothing reads them after the last kind moves. The override documents `dateedits`, `examedits`, `planedits`, `dayedits` go as described in 2.2, 2.9. `answers` documents go to `attempts`.

## 3. The migration (the migration task)

v5's live database does not exist yet and staging holds synthetic rows only, so no row is copied (§data.own-db). The rule "added, never rewritten" (§data.migrations) still holds, so the shape is expand then contract, not an edit of 0000:

1. **0006 expand:** one migration, all `CREATE TABLE IF NOT EXISTS` for the tables above plus `ALTER TABLE ... ADD COLUMN` for `collections`, `pins` and `drafts` (allowed by §data.additive; the ALTER ban in `migrations.test.ts` goes). Every new table has its id `CHECK`, its indexes and its partial unique indexes. Nothing is dropped.
2. **Migrate:** there is nothing to copy. Staging is reseeded through the gate by `data/staging/seed.ts` once the last kind has moved.
3. **0007 contract:** drops `docs`, `deletions`, `memberships`, `item_props`, `own_*`, `system_docs`, `claude_usage`, `claude_reads`, `claude_plan_asks`, `claude_settings`. It lands only after the last reader and writer has moved (the cleanup task in section 6) and a Time Travel bookmark is noted before it runs on any live database.
   The PRAGMA test (the migration task) compares `PRAGMA table_info` and `PRAGMA index_list` with each table's row schema keys and declared indexes; a table without a kind-prefixed id, `at`, `v`, or `deleted_at` where deletable fails it (also the docs-kind check task check 3).

## 4. Export and restore (§data.export)

- **File kind:** `ev5-export`, `schema: 2`. The manifest has one entry per v5 table: `{count, sha256, columns}`, the hash over canonical rows ordered by primary key. The table list in `data/export/tables.ts` is generated from the row schemas; a test fails if a migrated table is missing from it, and a table appears in no other list.
- **Files:** the export lists each `files` row with its SHA-256 and copies the bytes into the bundle (note pictures are small); the drill recomputes the hashes.
- **Restore refuses** (with a reason, writing nothing): any file whose `kind` is not `ev5-export` (an ev4 backup is a different shape and has none), `schema` below 2, a manifest that lacks a v5 table or names a table v5 does not have, or rows that do not match their own manifest. the docs-kind check task check 7 pins this.
- **Drill:** restore as written into an empty scratch D1 with migrations applied, compare the scratch's manifest with the file's, then migrate; then report orphans (links, `(kind, id)` pointers, `files` without bytes, bytes without a `files` row) and fail on any in an export from staging. Every table above is in both the export and the drill, including append-only tables and `settings`.
- The nightly backup and the Sunday Markdown mirror keep their current destinations; the mirror reads `notes.text` and the note body, not `docs`.

## 5. Ending the generic docs route (§data.gate)

Today `PUT /docs` and `/docs/batch` accept any kind and check only notes. The end is staged so nothing breaks:

1. **Per kind:** when a kind's table, command and reads land, its collection name is refused by `PUT /docs` with "use the command" (the list of kinds still allowed shrinks; the docs-kind check task check 2 fails a PR that writes a kind off that list).
2. **Outbox:** note saves post to `note.save` (the notes move) and answers to `study.attempt` (the attempts move), which write through the gate. The outbox never calls `/docs`. Its offline queue stays notes and answers only (§data.offline).
3. **Reads:** the since-sync (`GET /docs?since`) and collection reads are replaced by per-screen paged reads from the generated client, with deleted rows left out.
4. **Last step:** the routes, `docsRepo`, `data/docs/*`, `domain/doc-row` and `server/doc-routes.ts` are removed in the cleanup task, which also lands migration 0007. E2E, seeds and staging scripts that write by `PUT /docs` move to commands first (the docs-kind check task check 8).

## 6. Order of follow-on work

Dependencies run top to bottom; items on one line can run in parallel.

0. **Decision.** The build manager records this design (and the three open choices) before anything starts.
1. **the row-shapes task** (re-scoped): the `domain/` row schemas for every table in section 2, plus `WireDoc` removal planning. Changes: `domain/<kind>` row shapes replace `docRowSchema`; `data/tables`, `jobs/runtime` and ceilings import them; `commands/` and `jobs/` drop their own plan shapes. No behaviour change yet. Needs this design only.
2. **the migration task**: migration 0006 and the PRAGMA test against the row-shapes task's shapes; `data/export/tables.ts`, the `ev5-export` v2 manifest and the drill cover every table. A generated typed repository per table over the existing `data/tables/gate.ts` is part of this task or a split-off task the build manager files ("tables gate", proposed). Changes: `data/migrations`, `data/export`.
3. **the docs-kind check task** (checks), in parallel with step 4: the guards of section 5 and 3. Lands early so each kind task is held to it.
4. **the goals-and-objectives move** goals, objectives and links (everything else points at goal and objective ids): `domain/goal`, `domain/link`, `data`, `date.create`, Today and Library readers; `dateedits` and `examedits` gone. Also moves `collections`/`materials` to the new columns.
5. **the notes move** notes (independent; the outbox note kind moves) and **the sets move** sets and items (after the goals-and-objectives move for links). the note-pictures task files follows the notes move.
6. **the attempts move** attempts (needs items): one `study.attempt` command, the outbox answer kind, `own_attempts` and answers documents stop being written.
7. **the weak-spots move** weak spots and events (needs objectives), then **the due-read task** the one derived read over attempts, events and objectives.
8. **the sessions move** sessions and events, then **the talk move** talk rows (needs sessions and attempts' `adhoc` sets for "just tell me").
9. **the first plan task** (plans and plan_items tables, repository; needs goals; includes `repeats`), **the second plan task** (study plan job output through `domain/plan`), **B-1034** (`d1PlanStore` approve and put-away use the repository). `planedits` and `dayedits` end here.
10. **Cleanup (to be filed by the build manager):** refuse and remove `/docs` routes and `data/docs`, migration 0007, re-seed staging through the gate, rerun the export and restore drill on staging, confirm every table is in both.
    Gates 3 to 6 rerun after step 10, as in `fresh-database.md`.

## 7. Choices settled here, and three left open with a default

Settled: goal kinds are data; the date is optional; Canvas facts and Matt's edits are separate columns on the goal; at most one plan in force per goal by a unique index; `dayedits` items are `plan_items` rows; every question has a `set_items` row so every attempt has `(item_id, item_v)`; item history is `set_item_versions`; attempts are keyed by the client's id for the outbox; one expand migration then one contract migration; export `ev5-export` v2 with a per-table manifest.

Open, each with a default the build manager may accept with "ok":

1. **Weak spots' `links` array** (ev4 allowed typed links from a spot to anything). Default: drop it; `duplicate_of` and the objective pointer cover what E.V. reads. Alternative: allow `weak_spot` as a `from_kind` in `links`.
2. **Item history.** Default: keep `set_item_versions` (small, append-only). Alternative: no history, attempts show the current text of an edited item.
3. **Ask E.V. chats.** Default: a new `chat_id` starts a new chat, the screen opens the latest. Alternative: one rolling thread per Matt with no chat boundary.
