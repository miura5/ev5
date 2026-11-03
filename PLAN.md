# E.V. v5: initialization plan

**Status:** the plan the ev5 repository starts from. It merges the original v5 plan with the architect's review of it against the ev4 prototype. The review, with its evidence, is in `docs/history/ev5-plan-review.md`.

**How this document relates to the others:**
- Phase 0 copies the rules in this plan into `CONTRACT.md`, each with a `§id`.
- From the Phase 0 gate onward, **CONTRACT.md wins** and this file is history. Only the build manager edits it, and only to tick off phases.
- Items marked **(confirm)** use the architect's recommendation until Matt answers. They are listed together in §15.

---

## 1. What E.V. is

Matt's personal study partner. He is a first-semester ADN nursing student, taking NUR 112 and BIO 201, on Central time, and he is its only user. E.V.:
- plans the day,
- writes and runs practice,
- tracks weak spots against upcoming exams,
- keeps notes and study sessions,
- and talks with him as an agent.

**Framing (confirm, C12):** E.V. is a **personal knowledge app with a study partner built in**. School is its first use, not its shape.
- There are no built-in courses or semesters.
- Matt groups things with his own collections, and pins what he wants in the sidebar.
- Under the hood, ev4's school collections (exams, weak spots, courses) stay as they are: a course shows up as one of his collections, and an exam as a dated goal. That is a UI mapping, not a schema change.

**The core loop.** Every feature serves it, or it waits:
**notes → practice → errors → weak spots and review → today's plan → back to practice.**

**E.V. is a coach, not a crutch.** Matt does the retrieval and the planning; E.V. proposes, questions and checks.
- She asks for his attempt before she explains.
- She proposes plans and changes, and Matt accepts or edits them.
- Every fact she states cites a source in his notes or sets. A fact without a source is marked "unverified".

A design that does Matt's thinking for him is a defect.

**Who decides:**
- **Matt** decides what goes live and the large decisions: personal data, money, accounts, anything on his Mac, and changes to something he uses daily.
- **The build manager (Claude)** decides everything else, up to staging.

**Priority order when goals conflict:** data safety → reliability → drift resistance → simplicity → learning features. The higher one wins, and the trade-off is written down.

## 2. Fixed ground

### 2.1 Hard limits
1. ~~No personal data in the repo.~~ **[Matt: removed 2026-11-02]** Matt removed this limit: he is accountable for his own data in his private repo. Secrets still never go in files (§10), and staging, fixtures, logs and builder prompts stay synthetic or id-only (C15, answered 2026-11-02).
2. Canvas is read-only: GETs through Matt's signed-in browser, never a token.
3. Nothing is deleted, except items Matt deletes himself, which are purged after 30 days (D-425). How the purge is timed is in §5.6.
4. Live deploys happen only on Matt's word, and only through staging.
5. Same Cloudflare Worker, same D1 database, same backups. Schema changes are additive only (§5.2) until the rollback window closes.
6. Model ids and prices come from the docs, never from memory.

### 2.2 Carried over from ev4
- **The record (the Chart):** one write path. The backlog, decisions and changelog are generated from it. ev4's history comes across as history: 382 decisions (D-044…D-425) plus all tasks, keeping one id sequence. Old decisions are context, never instructions.
- **Delivery first:** staging, then one real end-to-end run, then Matt tests.
- **The phone stays frozen at "it works".** v5 keeps ev-live's URL, so the installed app keeps working.
- **Delete works as in Linear:** right-click or ⋯, then Recently deleted for 30 days.
- **⌘J toggles Ask E.V.**
- **E.V.'s session comments belong to the session.**
- **Quizlet stays Matt's flashcard tool** until E.V.'s cards return with FSRS scheduling (§5.7).
- **Design:** E.V.'s own design system, **Proprietary** (§7).

## 3. What v5 fixes

| ev4 problem (evidence in the review) | v5 rule |
|---|---|
| The page was 70 fragments of one closure, with state shared across 5–24 files | Real modules, one feature per folder, no exported mutable state |
| Six job runtimes, and one (in-tab practice writing) had no record at all, which caused B-688 | One job record and state machine. **Every model call that outlives one reply is a job.** E.V. reads job status through a tool |
| E.V.'s tools, Matt's buttons and the schedule each defined actions their own way | One command registry. Tools, buttons, ⌘K and schedule entries can only come from it |
| Rules restated in CLAUDE.md, skills, spec and tools, and drifting apart (R-03 still stated after it ended) | One rules file, CONTRACT.md, with `§id`s. Everything else cites ids or is generated |
| Superseded decisions cited in code as live reasons (130 citations) | No decision or task ids as reasons in code. Code states behaviour; the record holds history |
| 54 files over 300 lines, and disguised splits | `max-lines` 300, no import cycles, folder entry points, no `export *` |
| Custom checks and a custom test harness that drifted | Standard tools: TypeScript, ESLint, dependency-cruiser, Stylelint, knip, Vitest, @playwright/test |
| Hand-written enums repeated in several lists (B-609) | One Zod schema per thing. Types, validation and tool schemas are derived from it |
| UTC crons drifting across daylight saving | One time module in America/Chicago; scheduling by Central date |
| Model output parsed loosely (B-491) | Strict structured output, then Zod validation, then semantic checks |

## 4. The skeleton

```
ev5/
├─ CLAUDE.md          pointer: read CONTRACT.md, load the skill for your role
├─ CONTRACT.md        the only hand-written rules (§ids)
├─ PLAN.md            this file (history after Phase 0)
├─ areas/             one folder per sidebar item: today/ ask/ library/ notes/ progress/ activity/
│  └─ <area>/         area.ts (route, nav entry, commands it adds) · <Name>.view.tsx · parts/ · <name>.test.ts
├─ shell/             [Mock-up: added] sidebar (areas, Pinned, running-job line, Recently deleted link),
│                     Detail host, ⌘K, and the screens no one area owns: collection page, saved view,
│                     Recently deleted
├─ kit/               Proprietary: the design system
│  ├─ tokens/         tokens.css (the only place colours, type and space are defined)
│  ├─ components/     <Name>/ Name.tsx · Name.css · Name.story.tsx · Name.test.ts
│  └─ patterns/       Row, E.V. line, Suggestion, Study card, Source, Detail, Doc  [Mock-up: changed]
├─ commands/          the one registry: <name>.command.ts · client.ts (generated)
├─ jobs/              <kind>/ job.ts · prompt.md · job.test.ts
│  └─ runtime/        Workflows wrapper, job record, executors, budgets, models.ts
├─ domain/            pure rules, no IO: <entity>/ · search/ · time/
├─ data/              IO only: D1 repositories, migrations, export, restore
│  └─ compat/         frozen ev4 schemas and protocol tests
├─ server/            the Worker (Hono): routes → commands → domain / jobs / data
├─ ops/               release, the record writer, scheduled commands, rollback runbook
├─ e2e/               Playwright journeys, one file per journey
├─ design/            mockup.html (the approved UI reference) · DESIGN-BRIEF.md
└─ docs/history/      the review and other history; never instructions
```

Each folder has a README of at most about 15 lines: a hand-written purpose line, plus a generated public interface and "must not" list.

**Import direction, checked by dependency-cruiser:**
- `areas` → `kit`, `domain`, `commands/client`
- `shell` → `kit`, `domain`, `commands/client`, and the generated area registry **[Mock-up: added]**
- `commands` → `domain`, `data`, job clients
- `jobs` → `domain`, `data`
- `domain` → only `zod` and `@date-fns/tz` (and `ts-fsrs` when cards return)
- `data` → `domain` schemas and `zod`
- `kit` → React, Radix primitives and `cmdk`, never the app

Other folders import a folder only through its `index.ts`. No import cycles.

## 5. Data and ev4 compatibility

ev4 and v5 share one D1 database. This section is what keeps ev4 working, and keeps rollback possible, while v5 changes around it.

### 5.1 What the data is
D1 holds one generic table, `docs(c, id, data JSON, at, v)`, plus five small tables: `claude_usage`, `claude_reads`, `claude_settings`, `claude_plan_asks`, `system_docs`. There are 36 collections, each with a JSON Schema in ev4's `spec/schemas/`. v5 keeps this table and reads every ev4 document without migration.

### 5.2 Additive means
**New tables, or nullable columns. Never** new fields, enum values or `schema` numbers inside existing collections. ev4 drops unknown note fields when it saves, and it rejects unknown fields elsewhere.

### 5.3 The write protocol v5 keeps
- Every write bumps `v` and sets `at` from the Worker clock.
- Documents are stored as canonical JSON.
- Saves are pinned to a version (`if_version`, 409 when stale).
- Batches are all-or-nothing.
- No delete path for runs or agents.
- `data/compat` holds frozen copies of ev4's schemas. CI validates every v5 write to an existing collection against them.
- **[Mock-up: added]** v5 writes to an existing collection use only that collection's existing `writer` values (for example `page` for Matt's own edits) and existing enum values. `source` names v5. A new `writer` value would be a new enum value (§5.2).
- **[Mock-up: added]** ev4 sets are immutable once written, and `answers` are keyed by their item ids. v5 never edits an ev4 set's items in place (see §5.10 and escalation E-1).

### 5.4 Backups
- The export covers **every non-virtual table**, with the `docs` section kept in ev4's manifest shape (per-collection counts and SHA-256).
- **No new table goes live before the export and the restore drill cover it.**
- Exports are never overwritten.
- A Time Travel bookmark is noted before every live migration.

### 5.5 Migrations
Wrangler migrations, starting with a baseline that only restates ev4's `schema.sql` (`IF NOT EXISTS`, a no-op on live). After that:
- each migration is additive and idempotent;
- migrations are added, never rewritten.

### 5.6 Deletes
- Soft deletes go in a new `deletions(c, id, at)` table, which ev4 ignores, so nothing is lost on a rollback.
- **No purge runs until the rollback window closes.** After that, the purge clears live D1 30 days after Matt's delete.
- Backups keep everything, and the UI says so **(confirm)**.
- **[Mock-up: added]** Recently deleted lists an item for 30 days, with days left, Undo and Restore. There is no "delete forever". After 30 days the item leaves the list but stays in D1 until the purge is allowed. Jobs are never deleted.
- **[Mock-up: added]** Deleting a collection writes one `deletions` row for the collection only. Its items' membership rows stay, so the items show as ungrouped, and restoring the collection regroups them.
- **[Mock-up: added]** During a rollback, ev4 shows items v5 deleted (it has no tombstones) and can't see v5-only things (§5.10). Nothing is lost. Going forward again, v5 shows its own state again.

### 5.7 Scheduling and review
- Weak spots keep ev4's fixed-interval scheduler, ported unchanged into `domain/weakspot`.
- FSRS (`ts-fsrs`) arrives with E.V.'s cards after cutover **(confirm)**. Cards start fresh, because ev4 has no per-card history, and every review is logged from the first one.
- **Principle:** derived state is always rebuildable from append-only logs (answers, events, reviews).

### 5.8 Search for grounding
- `LIKE` over `docs`, plus passage scoring in `domain/search`. **No FTS5 in live D1**: a virtual table blocks D1 export.
- A retrieval test set (synthetic course text) proves search is good enough.
- If it fails that test, a derived and rebuildable index goes in a separate database **(Matt decides then)**.

### 5.9 Offline
- The page runs from its IndexedDB copy. v5 uses a different IndexedDB name from ev4's `ev-app`.
- Only append-only or version-pinned writes queue offline: note saves (a stale save keeps both versions, as an "(earlier)" copy) and practice answers.
- Every other write is online-only and shows "not saved" when it fails.

### 5.10 Where the mock-up's new things live **[Mock-up: added]**
Each item has a home in ev4's existing shape, or in a new table (§5.2). Every new table follows §5.4–§5.5: an additive, idempotent migration, plus `at` and `v` columns with the same protocol as `docs`. Each one is in the export, with a count and a SHA-256 over its canonical rows, and in the restore drill **before** it goes live.

| New thing | Home | When | The export and restore drill must also show |
|---|---|---|---|
| Collections, nesting one level | new `collections(id, title, parent_id NULL, pos, at, v)`. ev4 courses (spec.courses) appear as read-only virtual collections `course:<key>`. Nesting is one level, checked in `domain/collection` | cutover (C13) | parents resolve after restore; no row has a grandparent |
| An item's collection (at most one) | new `memberships(item_c, item_id, collection_id, at, v)`, PK `(item_c, item_id)`. The effective collection is the row if there is one, otherwise ev4's `course` field. Moving into a course writes ev4's existing `course` field and removes the row | cutover (C13) | every row points to an existing item and collection, or is reported as an orphan (never dropped); in rehearsal 2, an ev4 `course` change made during the rollback wins over an older row |
| Pins | new `pins(target_c, target_id, pos, at)` | cutover (C13) | order kept; pins to deleted items stay hidden, not lost |
| Saved views | new `views(id, title, query JSON, at, v)`; `query` is a Zod schema in `domain/view` | after cutover | queries parse after restore |
| Plan-item time, repeat and linked item | Manual plan items stay ev4 `dayedits.added` entries (`by: "Matt"`, `minutes` = estimate). Time, repeat, linked item, and overrides for morning-made items (ev4 has no override field) go in new `item_props(c, id, time, repeat JSON, linked_c, linked_id, overrides JSON, at, v)`. A repeat materializes each day's occurrence into `dayedits.added` under the idempotent key `rep-<id>-<date>`, so ev4 sees it after a rollback | cutover | re-running materialization after a restore adds no duplicates; linked targets resolve or are reported |
| Dates that aren't exams | ev4 `dates` with `kind: "other"`, `writer: "page"`. Edits to Canvas dates go in ev4's `dateedits.overrides`. Repeat and linked item go in `item_props` | cutover | covered by the `docs` manifest; `item_props` as above |
| Sets typed by hand; question sets now, card and step sets later | new `own_sets(id, title, type, source_c, source_id, at, v)`, `own_set_items(set_id, item_id, pos, body JSON, at, v)`, and append-only `own_attempts(set_id, item_id, key, at, body JSON)`. Item bodies are Zod schemas per type. ev4 sets stay read-only (see E-1). Weak-spot derivation reads both ev4 `answers` and `own_attempts` | questions at cutover (C13); cards and steps after, with FSRS (C3) | item order and per-set counts match; attempts are never rewritten |
| E.V.'s pending drafts and Today proposals | new `drafts(id, job_id, kind, target_c, target_id, body JSON, state pending·kept·dropped, at, v)`. Keeping one copies it into its home (an `own_set_items` row, a `dayedits.added` entry, an ev4 `sets` save) and marks it kept, in one batch | cutover | states kept; a kept draft's copy exists exactly once |
| Mark as learned | ev4's existing `solid` event in `weakspots.events` (`by: "owner"`). No new storage | cutover | covered by the `docs` manifest |
| Weekly review's proposed weak spots | ev4's existing `proposed` flag, plus `accept`/`decline` events. No new storage | cutover | covered by the `docs` manifest |

## 6. Jobs, commands and E.V.

### 6.1 Commands
One registry. Each command declares:
- its name and input (a Zod schema);
- its callers: Matt, E.V., the schedule, or an external executor;
- its effect: instant, or it starts a job;
- its mode per caller: **direct** or **propose**.

When E.V. calls a command that would change Matt's plan, lists or schedule, it runs in *propose* mode and creates a dashed Suggestion. E.V.'s Claude tools, their descriptions, ⌘K and the schedule are all generated from the registry, and the build fails on any defined elsewhere.

**[Mock-up: added] The registry the interaction map implies.** Each command has an undo where the mock-up shows Undo. Callers are **M** (Matt), **E** (E.V., in propose mode unless marked *direct*), **S** (the schedule) and **X** (an external executor). Entries marked *later* ship after cutover.
- **Any item** (M): `item.open`, `item.pin`, `item.unpin`, `item.move` (to a collection), `item.delete` (to Recently deleted), `item.restore`, `item.rename`.
- **Shell** (M): `palette.open`, `palette.to_ev` (Tab), `theme.toggle`, `nav.go`.
- **Plan items** (M; E proposes): `plan.create`, `plan.update` (date, time, estimate, repeat, linked, collection), `plan.toggle_done`, `plan.move_tomorrow`, `plan.start`, `plan.start_next`.
- **Proposals and drafts** (M): `proposal.accept`, `proposal.edit`, `proposal.dismiss`, `draft.keep`, `draft.drop`, `draft.keep_all`, `draft.drop_all`. (E creates proposals and drafts through the propose mode of the commands above.)
- **Dates** (M; E proposes): `date.create`, `date.update`; `date.plan_with_ev` starts the study plan job.
- **Study plan** (M): `studyplan.approve`, `studyplan.ask_changes`, `studyplan.put_away`; `studyplan.rate` *later* (C9).
- **Weak spots** (M): `weakspot.drill`, `weakspot.mark_learned`, `weakspot.confirm`, `weakspot.decline`, `weeklyreview.done`. E proposes weak spots only through the weekly review and practice.
- **Sets** (M): `set.create`, `set.update` (title, type, collection, source), `set.item_add`, `set.item_update`, `set.item_delete`, `set.done`; `set.write_with_ev` starts the practice set job in draft mode; `set.unverified_keep`, `set.unverified_drop`, `set.save`.
- **Study and practice** (M): `study.start`, `study.attempt`, `study.reveal`, `study.just_tell_me` (logged), `study.leave`; `study.grade` (Again / Good) *later*, with cards.
- **Notes and sessions** (M): `note.create`, `note.save` (outbox), `note.move`, `session.start`, `session.pause`, `session.end`, `check.answer`, `check.just_tell_me` (logged); `note.make_cards` *later*.
- **Collections** (M): `collection.create`, `collection.new_here` (note, set, date or collection inside); delete, rename and pin go through the item commands.
- **Saved views** (M) *later*: `view.create`, `view.update`.
- **Jobs** (M): `job.stop`, `job.retry_shorter`, `job.dismiss`. **E direct:** `job_status`.
- **Ask E.V.** (M): `ask.send`, `ask.just_tell_me` (logged).
- **Scheduled** (S): `morning`, `evening`, `weekly_review` (Sundays; it ends as a Needs-you item in Activity), `export`, `restore_drill`, `push_summary`. **X:** `canvas_sync`, reported through `report_job`.
- **Never callable by E.V.:** delete, restore, pin, approve, keep or drop, mark as learned, and every "just tell me".

### 6.2 Jobs
- **A job is a D1 record with a lifecycle:** queued → running → needs you → done, or failed with the reason in plain words. It records its cost and where its output went.
- **`defineJob({...})`** holds the whole contract: kind, title, input and output schemas, model, max tokens, cost cap, steps, wording, and who may start it.
- **Executors:**
  - a Cloudflare Workflow runs model jobs;
  - a Worker cron runs scheduled commands;
  - a Mac session runs the Canvas sync, which needs Matt's signed-in browser, and reports through `report_job`.
- **"Needs you" is a D1 state, not a waiting Workflow.** The instance ends there. Matt's answer starts a continuation instance with id `jobId:step`, so it is idempotent.
- **Steps return ids, never content.** Content goes to D1.
- **One retry layer:**
  - the step's retry policy; the Anthropic SDK uses `maxRetries: 0` inside steps;
  - the Claude call and the D1 write are separate steps;
  - usage is recorded in the call step, keyed by instance + step + attempt.
- **Fallback** if Workflows fails its spike: ev4's proven Durable Object alarm pattern, or Queues, with the same job record.
- **E.V. never asks in chat on a job's behalf.** A job that needs Matt says so in Activity. Its output lands in its home (Library, Today, Notes), and chat links to it. E.V. reads job state through the generated `job_status` tool.

### 6.3 Model output
- Strict structured output, using a schema derived from the job's Zod output schema **[verify support for the chosen model]**.
- Check `stop_reason`: `max_tokens` or a refusal fails the job with the reason.
- Then Zod validation, then semantic checks, including that every cited id was in the excerpts given.
- On failure: one repair ask with the errors, then fail. Half-parsed output never lands.

### 6.4 Jobs at cutover
1. **Practice set.** Mock exam is a variant of it.
2. **Study plan.** Sonnet, multi-step, and needs-you for Approve. Its approved tasks appear on Today.

Other job kinds (study guide, clinical prep, share set, exam retro) follow after cutover, in an order set by live usage counts.

**[Mock-up: added]** No new job kind comes from the mock-up:
- **"Write with E.V."** (Library, an empty set, Edit mode) is the practice set job with a *drafts* output: its items land in `drafts` against the set, and Matt keeps or drops each one. The job finishes with "you kept N of M".
- **A practice set with unsourced items** lands as drafts too. Matt keeps each one, marked unverified, or drops it, then saves. Only then is the ev4 `sets` document written.
- **"Make cards"** (a note) is the same job with the card item schema. It ships *after cutover*, with cards and FSRS (C3).
- **The weekly review** is the `weekly_review` scheduled command. Its run is in the job record, and it waits in Activity as Needs you (confirm or decline each proposed weak spot). It isn't a line on Today.

### 6.5 Models and cost
- Ids and prices live only in `jobs/runtime/models.ts`, with a "checked on" date. A check warns when it is old, and no environment variable overrides it.
- Practice uses Haiku with a 32,000-token budget **[verify against the model's maximum]**.
- Prompt caching on stable prefixes (the system prompt and course context).
- Ceilings:
  - hourly and daily, kept from ev4, as D1 settings that can change without a release;
  - an atomic per-job ask cap;
  - **a new monthly ceiling.**
- Every call reserves its maximum cost before it starts.
- At 80% of the monthly ceiling, an Activity "needs you" alert and one line on Today.
- A ceiling hit fails the job cleanly, and nothing lands.
- The Anthropic Console spend limit stays the final backstop **(confirm it is set)**.

## 7. Layout and UI: Proprietary

**[Mock-up: changed] Approved.** Matt approved `design/mockup.html` (round 7). Its rules are below and move into CONTRACT.md in Phase 0. The change list is `design/CHANGELIST.md`, and the evidence is `design/mockup-audit.md`. `design/DESIGN-BRIEF.md` is now history for looks.

**Design system decision:** v5 uses **Proprietary, E.V.'s own design system**: its tokens (orange accent, dark first, Inter, three text sizes) and its own components and patterns in `kit/`.
- It is **not** an existing UI framework's look.
- Under the hood, **unstyled** Radix primitives and cmdk handle focus, keyboard and menu behaviour, and are never visible as a style. The kit owns every pixel.
- Story gallery: a `/kit` route rendering every `*.story.tsx`, visually diffed by Playwright in its Docker image.

**The approved mock-up** (`design/mockup.html`) is the visual reference. When the mock-up and this text disagree on looks, the mock-up wins. On rules, this text wins.

**Layout:** five regions, each generated from its folder:
1. **Sidebar:** from `areas/*/area.ts`: Today, Ask E.V., Library, Notes, Progress, Activity, then **Matt's pins** (collections, saved views, notes, sets, plan items, dates). Counts, no badges. At its foot: a running job as one quiet line, then **Recently deleted**. **[Mock-up: changed]** (was "then Courses"; C12)
2. **Area:** one centred column, at most 720 px. **[Mock-up: added]** Notes is a home list (recent, then collections as folding rows nested one level) plus one centred page per note. A list and a doc are never side by side. A set has one page with two modes, view and Edit. There is no separate editor screen.
3. **Detail panel:** one panel for any item. Each domain type defines how it is shown.
4. **⌘K:** the command registry, filtered by where you are, plus found items and pins. Tab hands the request to E.V.
5. **Activity:** jobs by state.

**UI rules:**
1. Two surfaces only (sidebar and content). No boxes inside boxes.
2. Three text sizes (20, 14, 12) and three greys. Weight 600 only for titles. **[Mock-up: added]** The one exception is the study card face, at 24.
3. One orange element per screen: the main action, or E.V.'s mark. **[Mock-up: added]** When Detail has a primary action, the screen's own primary steps down.
4. Status shown only as a dot or a meter. **[Mock-up: added]** The plan ring and the job ring are glyphs that also carry status.
5. Lists without frames. Actions appear on hover, focus or right-click.
6. E.V. speaks once per screen. Her suggestions appear dashed, in the list they would change.
7. 8 px grid, 40 px rows, 48 px between sections.
8. Keys instead of extra buttons. **[Mock-up: changed]** Shortcut hints sit quietly beside actions, as well as in tooltips and ⌘K.
9. One question at a time. Only the thing being answered gets a frame.
10. The answer comes after the attempt, in practice **and** in Ask E.V. A "just tell me" is always one key away, and it is logged. (Browsing your own set on its page shows answers; study enforces the attempt.)
11. **[Mock-up: added]** Every item Matt owns (plan item, note, set, date, collection, saved view) can be created, edited and deleted by hand, from where it lives.
12. **[Mock-up: added]** Delete moves the item to Recently deleted for 30 days, with Undo and Restore. There is no "delete forever", and jobs are never deleted (§5.6).
13. **[Mock-up: added]** Where E.V. can help, there is one quiet "with E.V." action beside the manual one. Her output arrives dashed and cited, in the list it would change, and Matt keeps or drops each piece.
14. **[Mock-up: added]** Keys: **C** creates the thing the screen holds · **E** edits a set · **⌫** deletes · **.** or right-click opens the item menu · **P** pins · **M** moves · **S** runs Detail's primary action · **X** toggles a plan item · **Esc** leaves.
15. **[Mock-up: added]** Titles and properties edit in place. Properties live in Detail. The one exception: a set's collection and source sit on its Edit page.
16. **[Mock-up: added]** An item sits in at most one collection. Collections nest one level. Deleting a collection leaves its items, ungrouped.
17. **[Mock-up: added]** Weak spots come from Matt's misses: E.V. proposes and Matt confirms. "Mark as learned" is a status, not a delete. Weak spots aren't one of the eight item types, so their rows have no glyph.
18. **[Mock-up: added]** One line glyph per type, eight in all: note, card set, question set, step set, plan item, job, collection, date. No colour-coding. A row shows at most four things.

**[Mock-up: changed] The kit's first set** is the mock-up's: Button (primary, one per screen; secondary, text, icon; key hint beside it) · Field (bordered input, segmented choice, borderless cell) · Row (glyph, title, one meta, one value; folding and two-cell editor variants) · Tile · Glyph (8) · E.V. line · Suggestion (proposal, draft) · Source ("from Note · …" or "unverified") · Study card (with the set's hero card) · Text options · Detail (properties in place, ⋯) · Menu (item actions and every picker) · ⌘K palette · Toast (one line, Undo) · Doc (the note page; the session bar and checks only during a session). Compared with the old list, Shortcut hint folds into Button and Job card into Row, and Sheet and Meter wait until an area needs them. Anything else is added when an area needs it, and a new look starts in `kit/` and its story, never in a view.

## 8. Cutover scope

v5 goes live, on Matt's word, when these match or beat ev4:
1. **Today:** the plan list, including approved study-plan tasks, the morning review set and note tasks; Suggestions; upcoming exams and other dates. **[Mock-up: changed]** The weekly review is a Needs-you item in Activity on Sundays, not a line on Today.
2. **Library:** practice (attempt first, cited feedback), weak spots, exams with their study plan, sets, and one retrieval-accuracy line. **[Mock-up: changed]** Weak spots (worst first, Drill) sit on the Library home and on a date's Detail, and the accuracy line sits under the Library title. Question sets can be made and edited by hand, with "Write with E.V." drafts (C13).
3. **Ask E.V.:** chat with the generated tools, attempt-first, and `job_status`.
4. **Notes, with study sessions:** the editor, images, two-column rows, read-along, session comments and check questions, writing time, and the offline outbox **(confirm)**.
5. **Activity.**
5a. **[Mock-up: added] Owning things (C13):** create, edit and delete by hand for plan items, notes, question sets, dates and collections; collections nested one level; pins; Recently deleted with Restore. Each new table is in the export and the restore drill first (§5.10).
6. **Jobs:** practice set and study plan.
7. **Scheduled commands:**
   - morning review set and drills;
   - evening weak-spot parking and prep check;
   - weekly review;
   - the Canvas sync through the Mac executor;
   - pushes to the phone through a thin cloud task that only reads v5's summary **(confirm)**;
   - the export and the restore drill.

**After cutover:** Progress (beyond the accuracy line), FSRS cards, the other job kinds, predictions and calibration, and Matt-first planning **(confirm)**: Matt rates his confidence per objective first, E.V. compares that with his accuracy and proposes, and he edits.

**[Mock-up: added] Also after cutover, though shown in the mock-up:** card sets and step sets, with due counts and Again / Good (C3); "Make cards" from a note; Learn and Test modes; saved views; rating confidence before approving a study plan (until then Approve works without ratings, C9); the phone layout (the phone stays as it is, §2.2). The mock-up shows the long-term design, and this list decides what ships first.

## 9. Failure modes (decided)

| Situation | What happens |
|---|---|
| Claude times out or returns invalid output | The step retries (the only retry layer). One repair ask on a validation failure. Then failed, with the reason. Nothing half-parsed lands |
| A job sits in "needs you" for days | It is a D1 state, so no instance waits. Activity shows its age, and E.V. offers once on Today to put it away. Nothing is auto-deleted |
| The cost cap is hit mid-job | The pre-flight reservation refuses the call, and the job fails cleanly with the reason. Matt can run it again |
| D1 is unavailable | The Worker returns 503 with Retry-After. The page runs from its local copy, and only outbox writes queue |
| A migration fails halfway | Wrangler rolls back the failed migration **[verify]**. Restore from the bookmark noted before it if needed |
| Daylight saving changes | The cron fires every 15 minutes. A command is due when its Central wall time has passed and no run exists for that Central date. Nothing is scheduled between 01:00 and 03:00 Central. Tested on 2026-11-01 and 2027-03-14 |
| A future FSRS replay meets bad history | Invalid events are skipped and logged. A card whose replay errors starts fresh and is flagged. Its state can be rebuilt |
| The phone is offline | The shell is cached and reads come from the local copy. Only note saves and answers queue |
| ev4 clients still open at cutover | v5 answers ev4's routes with 410 "E.V. updated, reload". On first boot, v5 offers to import any unsent ev4 outbox notes |

## 10. Security and privacy

- **The Anthropic key** is a Cloudflare secret on the Worker only, and never reaches the browser. The server picks the model and max tokens. Staging has its own key with a low cap.
- **Auth:** a bearer token per caller (app, cloud schedule, Mac executor), each scoped to its routes. Constant-time compare (ev4's `pwa/guard.js` pattern). Rate-limited wrong attempts. Only the app token can change ceilings.
- **The public shell holds no personal config.** Settings load from D1 behind the token.
- **Logs and Workflow step outputs** hold ids and counts, never prompts or note text.
- **Staging uses synthetic data only (confirm).** The one real-data check (§13, Phase 3) runs read-only in a restricted scratch copy and reports counts and errors only.
- ~~**The personal-data scan**~~ **[Matt: changed 2026-11-02]** A **secrets scan** (API keys, tokens, `.dev.vars`) runs in CI instead. Personal data is no longer a repo limit (§2.1.1).

## 11. The workflow that prevents drift

- **One task, one slice.** A task names the folders it may write. Its context is those folders, CONTRACT.md, and the generated public interface of what it imports.
- **Interface changes:**
  1. A folder's interface is its `index.ts` exports, its schemas, command names, job kinds and owned tables, listed in its generated README.
  2. A commit that changes that listing carries an `Interface: <folder>` trailer, or CI fails.
  3. Changes go expand → migrate → contract. Nothing in `data/compat` is removed inside the rollback window.
- **Size:** files at most 300 lines (ESLint). Changes of about 400 lines or less is a review guideline.
- **Checks on every pull request** (GitHub branch protection makes them unskippable):
  - types;
  - ESLint, with inline disables refused and `ban-ts-comment`;
  - dependency-cruiser;
  - Stylelint (tokens only);
  - knip;
  - the secrets scan **[Matt: changed]**;
  - compat: v5 write fixtures validate against `data/compat`;
  - registry: no tool, button or schedule entry outside `commands/`;
  - presence: every component has a story and a test, every job and command a test;
  - Vitest;
  - generated files up to date (regenerate, then `git diff --exit-code`).
- **Every batch:** the e2e journeys and the `/kit` visual diff, in the Playwright Docker image.
- **Rules:**
  - CONTRACT.md is the only rules file. Skills and READMEs cite `§id`s.
  - A check fails a skill or README that copies a CONTRACT line, states a never/always/must/only rule without a `§id`, cites an ended `§id`, or is too long.
  - Tool-enforced thresholds live in the tool's config, and CONTRACT links to it.
- **Dependencies:** a new runtime dependency needs a Chart decision naming the problem it solves. Pin versions. Knip fails on unused ones.
- **The design system leads.** A UI change starts in `kit/` and its story.

## 12. Import, translate or cut

| Need | Decision |
|---|---|
| Schemas, validation, tool schemas | Import `zod` |
| ev4 compatibility tests | Import `ajv` (dev only) |
| Worker routing | Import `hono` |
| Job durability | Cloudflare Workflows (pending the Phase 0 spike) |
| Claude calls | Import `@anthropic-ai/sdk` **[verify on Workers]** |
| Menus, popovers, focus | Import Radix primitives (unstyled) |
| ⌘K | Import `cmdk` |
| Time zones | Import `@date-fns/tz` |
| Notes editor view | Import ProseMirror/Tiptap **[verify licence]**. Translate ev4's JSON block format and the pure note model |
| PWA | Import `vite-plugin-pwa` |
| Lint and structure | ESLint, dependency-cruiser, Stylelint, knip |
| Tests | Vitest, @playwright/test (no custom harness) |
| D1 access | Translate ev4's protocol into a new typed wrapper over `docs` |
| Tokens | Carry ev4's values into a static `tokens.css` (there is no generator to translate) |
| The record | Carry `chart/*.json` as data; write a new small writer |
| Collections, pins, own sets, drafts, item properties | **[Mock-up: added]** New D1 tables through Wrangler migrations (§5.10), each with a `domain/<entity>` Zod schema. No new dependency |
| Repeat rules (plan items, dates) | **[Mock-up: added]** Write a small rule (daily, weekdays, weekly, every N days) in `domain/time`. No recurrence library |
| Canvas sync | Translate the GET scripts, `normalizeCanvas` and the readers. Add pagination. The Mac executor reports through the job record |
| Cut | FTS5; the token generator; the FSRS replay; ev4's release ceremony in `chart.mjs`; the custom harness; the D-/B-id comments |

## 13. Phases and gates

Phases run in order, and each ends at a gate. Phases 2 and 3 run in parallel, and Phase 4 needs both.

**Phase 0: Decide and freeze**
- ev4 goes to bug fixes only. One fix removes the Mac path and the Canvas host from ev4's public spec **(confirm)**.
- Matt's confirmations (§15) are recorded.
- Sweep the 322 accepted ev4 decisions into CONTRACT.md (about 75–150 lines, every rule with a `§id`). Matt confirms only its hard-limits section.
- Write `data/compat`.
- **Spike: Workflows.** On the current plan tier, show:
  - needs-you as a D1 state, finishing through a continuation instance;
  - a deploy while an instance runs;
  - a redeploy that removes the binding, as an ev4 rollback would;
  - the limits **[verify]**.
- **Spike: the notes editor.** A lossless blocks ⇄ ProseMirror round trip on synthetic notes and on the behaviours in ev4's notes harness.
- **Gate:** CONTRACT.md, `data/compat`, both spike results and Matt's answers are in the repo and the Chart.

**Phase 1: Repo, guards, walking skeleton**
- Empty folders, every check in §11 in CI, registries generated from empty folders.
- Prove that each guard fails when it should: a 301-line file, a bad import, a cycle, an inline disable, a raw colour, an unused export, a component without a story, a write fixture ev4's schema rejects, a tool defined outside the registry.
- Deploy the empty app to a v5 staging Worker with a synthetic D1 through CI. v5 never uses ev4's staging, which ev4 bug fixes still need.
- **Rehearsal 1**, on a throwaway Worker+D1 pair with ev4's synthetic record:
  1. deploy ev4;
  2. deploy empty v5 over it;
  3. confirm ev4's routes get a 410;
  4. roll back with the runbook;
  5. confirm ev4 boots, reads and writes, `PlanJob` is intact, and ev4's IndexedDB is untouched.
- **Gate:** every guard has been shown to fail, and rehearsal 1 passes.

**Phase 2: Kit (first set)**
- `tokens.css` from ev4's values (`page/theme.js` R4 and `page/ds/tokens.css`), matching the approved mock-up.
- First-set components with stories, the `/kit` gallery, visual baselines.
- **Gate:** baselines committed, and the gallery matches the mock-up.

**Phase 3: Domain and data**
- `domain/time` first, with the DST tests.
- Entities, smallest first: exam, objective, weak spot (with its scheduler), set, item, session, note, course. Bring ev4's tests across.
- **[Mock-up: added]** Then the new entities from §5.10: collection and membership, pin, item properties (with repeat), own set and its items and attempts, draft. Each has its migration, repository and compat fixture.
- Repositories over `docs`; the migration baseline; the export of every table (**[Mock-up: added]** including every §5.10 table); the `deletions` table, with no purge yet.
- `domain/search` with the retrieval test set.
- **Gate:**
  - domain tests pass;
  - every write fixture passes `data/compat`;
  - the repositories parse every synthetic document;
  - one read-only, counts-only parse of a restricted scratch copy of live finds zero errors (run with Matt's OK).

**Phase 4: Commands, runtime, server**
- The registry, generated tools and descriptions, and `job_status`.
- The runtime: states, needs-you as a D1 state, ceilings including monthly, the single retry layer, structured-output validation.
- The two cutover jobs (practice set, study plan), grounded with citations.
- Hono routes, scoped tokens, and ev4-route refusals.
- **Gate:** both jobs run on v5 staging. A forced invalid output, a forced `max_tokens` and a forced ceiling hit each end as a clean failure with the reason.

**Phase 5: Shell and cutover areas**
- Sidebar, ⌘K, Detail panel, Activity, Today, Library, Ask E.V., Notes with sessions.
- **Gate:** e2e journeys pass for:
  - plan today (**[Mock-up: added]** including add, edit, delete and restore a plan item);
  - do a practice set;
  - **[Mock-up: added]** make a question set by hand, then keep and drop E.V.'s drafts;
  - **[Mock-up: added]** make a collection, move a note into it, pin it, delete it and restore it;
  - make and approve a study plan;
  - write a note offline, then sync;
  - run a study session;
  - ask "is it ready?" while a job runs.

**Phase 6: Ops**
- The record writer, carrying `chart/*.json`.
- Scheduled commands on the 15-minute cron.
- The Mac executor for Canvas; the push task.
- Restore drills: R2 export → scratch D1 with a matching manifest for every table; one Time Travel restore on staging. **[Mock-up: added]** The drills also run the checks in §5.10's last column.
- **Rehearsal 2:**
  1. cut over;
  2. write in v5;
  3. roll back;
  4. write in ev4;
  5. go forward again, with v5 re-deriving what it owns from ev4's append-only writes. **[Mock-up: added]** Also check that ev4 `course` changes made during the rollback win over older membership rows, and that repeat materialization adds no duplicates.
- One real end-to-end run.
- **Gate:** the end-to-end run, both drills and rehearsal 2 pass.

**Phase 7: Review and Matt's test**
- A whole-repo code review (lost data, cost, security, crashes, unreachable controls).
- A UX pass against the UI rules and the mock-up.
- A release card. Matt tests on staging.

**Cutover** (on Matt's word):
1. Check every device's ev4 outbox is empty.
2. Disable ev4's cloud tasks. Re-create the Mac tasks for v5 with Matt present.
3. Take an R2 export and note the Time Travel bookmark.
4. Ship v5 to ev-staging, then to ev-live. The deploy itself is ev4's write freeze.
5. Verify parity against the manifest.

**Rollback** (on Matt's word, any time in the window): run the runbook in `ops/`.
1. Drain jobs.
2. Deploy the tagged last ev4 live build through ev4's own workflow.
3. Re-enable ev4's tasks.

While the window is open, v5 keeps a `PlanJob` stub class and never ships a Durable Object deletion. The window ends on Matt's word, after one exam on v5 with no rollback-worthy bug **(confirm)**.

## 14. Risks we accept, and what waits

- **Building competes with studying.** In exam weeks, only bug fixes go in. Matt says "exam week" and the build pauses features.
- **Workflows may not fit the plan tier.** The fallback is ev4's Durable Object alarm pattern, with the same job record.
- **Workers Free plan:** Time Travel covers only 7 days there **[verify]**. Moving to the paid plan is Matt's call **(confirm)**.
- **What waits:** FSRS cards, Progress beyond one line, other job kinds, Matt-first planning, predictions, any search index, Web Push.

## 15. Matt's confirmations (answered 2026-11-02: all defaults)

| # | Question | Default (architect's recommendation) |
|---|---|---|
| C1 | Staging data | Synthetic only, plus one read-only, counts-only check of a scratch copy |
| C2 | Cutover scope | Notes with sessions and the study plan job are in it |
| C3 | Cards and FSRS | After cutover, starting fresh |
| C4 | Purge and backups | Purge live only, after the rollback window. Backups keep everything |
| C5 | Money | Start on the Free plan, and move to paid only if the spike or the rollback window needs it. Confirm the Console spend limit is set |
| C6 | End of the rollback window | Your word, after one exam on v5 |
| C7 | Phone pushes | A thin cloud task reads v5's summary and pushes |
| C8 | Public ev4 repo | Remove the Mac path and Canvas host from HEAD. No history rewrite |
| C9 | Planning style after cutover | You rate confidence first, and E.V. critiques and proposes |
| C10 | ev5 repo visibility | Private, unless live-deploy approval needs public **[verify GitHub plan]** |
| C11 | Room for the build | Trim ev4's watchdog from 8 to 2 runs a day, so the build's scheduled runs fit the daily cap **[verify the count]** |
| C12 | What E.V. is | A personal knowledge app with a study partner built in. No built-in courses. Collections and pins are his own. The data contract and cutover scope are unchanged |
| C13 | **[Mock-up: added]** Owning things at cutover | Hand-made question sets with E.V.'s drafts, collections (nested one level), pins and Recently deleted are all in cutover, each behind the export and restore drill (§5.10). Card and step sets and saved views come after |
| C14 | **[Mock-up: added]** Editing a set E.V. wrote in ev4 (E-1) | Copy on first edit: Edit turns it into your own set; the original and its answer history stay untouched, and the original is hidden |
| C15 | **[Matt: added]** Where personal data may go now that §2.1.1 is gone (E-2) | Allowed in the repo, but staging, fixtures, logs and builder prompts stay synthetic or id-only (C1, §10) |
