# E.V. v5: the contract

The only hand-written rules. One rule per line, each with a stable `§id`. Skills, READMEs, prompts and code cite `§id`s and never restate a line. A trailing `<!-- … -->` names where a rule came from; it is never the reason. A rule that ends moves to `docs/contract/ended.md` with its id, through a Chart decision. ev4 rules that ended at v5 are listed there too.

## 1. Hard limits

> Matt's yes given 2026-11-02 (D-451). Only things an agent can't undo: lost data, a broken live app, a leaked secret, money spent.

- §hard.data-never-lost · Matt's data in v5's D1 database and its backups is never lost: only items he deletes himself are purged, 30 days after his delete (§delete.purge); v5 never reads or writes ev4's database, buckets or Durable Objects, which stay as they are as an archive (§data.own-db). <!-- PLAN §2.1.3, §5.6; reworded when the rollback to ev4 ended -->
- §hard.live-on-matts-word · Live deploys and rollbacks happen only on Matt's word, only after staging, and only through the approval-gated `live` GitHub environment. <!-- PLAN §2.1.4, D-331 -->
- §hard.no-secrets-in-files · Secrets (API keys, tokens, `.dev.vars`) never go in a file, commit, prompt or log; they live only as Cloudflare or GitHub secrets. <!-- PLAN §10, D-301, D-309, D-320 -->
- §hard.ev4-own-process · ev4's repo, live data, resources and tasks change only through ev4's own process, never from v5's build. <!-- AGENTS §9-10 -->
- §hard.money · No spending, plan upgrade, new paid service or account change without Matt's word. <!-- PLAN §1, D-451 -->

## 2. What E.V. is
- §what.framing · E.V. is a personal knowledge app for one independent learner with any subject or goal (school, a certification, an interview, a career move, or learning for its own sake). No subject, exam type, unit list, question style or course system is built in: kinds, units and styles are data, and no course is named in code. A course is a collection the user names. A date is a goal with a kind, exam is one kind, and one registry in `domain/goal` maps each kind to its tools. E.V. says "you" to the user and "the user" in a description, never "the student"; "study" is a verb, never part of a thing's name. <!-- C12, D-099, D-494, D-498, D-499, D-500, D-502, D-503, D-512 -->
- §what.loop · Every feature serves the loop notes → practice → errors → weak spots and review → today's plan → practice, or it waits; Matt does the retrieval and the planning, E.V. proposes, questions and checks, and a design that does his thinking for him is a defect. <!-- PLAN §1 -->
- §what.priority · When goals conflict: data safety → reliability → drift resistance → simplicity → learning features; the higher wins and the trade-off is written down. <!-- PLAN §1 -->

## 3. Data
- §data.additive · A column or table is removed only expand → migrate → contract, once no release reads it; adding a table or column is an ordinary migration. <!-- PLAN §5.2, PLAN §11; the rollback window ended -->
- §data.protocol · Every write bumps `v`, sets `at` from the Worker clock, stores canonical JSON and is pinned to a version (`if_version`, 409 when stale); batches are all-or-nothing. <!-- PLAN §5.3, D-329, D-341 -->
- §data.own-db · v5 keeps its record in its own D1 database, one table per kind, which starts empty: nothing is copied from ev4. D1 is the only live record: nothing reads, writes or syncs a claude.ai artifact database. <!-- D-297, D-307; Matt chose an empty start 2026-11-05 -->
- §data.same-worker · v5 runs as the ev-live Worker, keeping its URL, with its own D1 database and R2 buckets; the Worker keeps ev4's PlanJob Durable Object class as a stub and ships no Durable Object deletion, because removing the class would delete ev4's stored state (§hard.ev4-own-process). <!-- PLAN §2.1.5 -->
- §data.canvas · E.V. never writes to an outside source such as Canvas. No outside import (such as Canvas) is planned; import ideas live in Matt's feature list outside the repo. <!-- PLAN §2.1.2, D-079, D-303, D-512 -->
- §data.links · Every id field that points at another collection or table resolves, or is reported as an orphan; never dropped. <!-- D-241 -->
- §data.tables · Ids start with their kind; a pointer is a typed column with an index, or a (kind, id) pair with an index only where it can name several kinds; appends are rows, never rewrites of a document; every table has `at` and `v` under §data.protocol, an export count and SHA-256, and a restore-drill check before it goes live. <!-- PLAN §5.4, §5.10; replaces §data.new-tables -->
- §data.gate · Every writer (commands, jobs, scheduled commands, the outbox's server side) writes through one gate in `data/`, the only place with SQL: it parses the row with its `domain` schema, applies the kind's write rules and the size budget, then §data.protocol; a refusal gives its reason and only a stale version answers 409; reads parse each row, report and leave out a bad one, and leave out deleted rows unless asked. <!-- PLAN §4, §5.3 -->
- §data.item-versions · Set items carry `v`; an attempt records the item id and version it answered, so editing an item never rewrites or orphans attempts. <!-- replaces §data.ev4-sets -->
- §data.append-only · Answers, events, reviews, attempts and talk are append-only; derived state is rebuilt from them, never stored as truth. <!-- D-047, D-068, D-095, D-120, D-128, D-064 -->
- §data.membership · An item sits in at most one collection, named by its `collection_id`; collections nest one level, checked in `domain/collection`. <!-- PLAN §5.10 -->
- §data.repeat · A repeat makes each day's plan item once, unique by repeat and day; repeat rules are written in `domain/time`, with no recurrence library. <!-- PLAN §5.10, §12 -->
- §data.drafts · E.V.'s drafts and Today proposals live in `drafts` until kept; keeping one copies it into its home and marks it kept in one batch, so the copy exists exactly once. <!-- PLAN §5.10 -->
- §data.migrations · Wrangler migrations build v5's own database from an empty baseline; each is idempotent and added, and never rewritten once applied to live; before cutover the chain is squashed once into one baseline (D-514); a Time Travel bookmark is noted before every live migration. <!-- PLAN §5.5, D-514 -->
- §data.export · The export covers every table with per-table counts and SHA-256 over canonical rows, goes to R2 and is never overwritten, with the nightly backup and Sunday Markdown mirror also in Matt's Mac backups folder; a restore drill restores it as written into a scratch D1, checks its own manifest, then migrates; and a restore into live happens only on Matt's word with him present. <!-- PLAN §5.4, D-302, D-091, D-186, D-057, D-061, D-322 -->
- §data.search · No FTS5 or other virtual table in live D1; search is `LIKE` over the plain-text columns of notes and materials plus passage scoring in `domain/search`, proven by a retrieval test set; any index is derived, in a separate database, on Matt's call. <!-- PLAN §5.8 -->
- §data.offline · v5's IndexedDB name differs from ev4's `ev-app`; only note saves and practice answers queue offline; every other write is online-only and shows "not saved" when it fails. <!-- PLAN §5.9 -->
- §data.notes · Notes keep the note block format (JSON blocks), translated losslessly to the editor (a two-column row is a flat-list mark: row id, col 0/1); an edit that shrinks an oversized note is allowed, and a stale save is never merged: both versions are kept, the one not kept as an "(earlier)" copy. <!-- D-325, D-332, D-418, D-326, D-498 -->
- §data.writing-time · A note's session counts writing time: it counts up, pauses after 2 idle minutes and saves itself after 60 paused minutes. <!-- D-353 -->
- §data.note-images · Note pictures live in the environment's R2 bucket under `note-images/`, served by the Worker to the owner only. <!-- D-417 -->
- §data.size · Every stored document has a size budget against its platform ceiling: a check warns at 75% and fails at 90%. <!-- D-183 -->
- §data.study-logic · The study logic is written in `domain` with tests and no subject: the fixed-interval weak-spot scheduler, day planning within a minutes budget, urgency only for dated goals due today or tomorrow, and a set done on its first attempt; no day types (class, lab, clinical) are built in. <!-- PLAN §5.7, D-051, D-086, D-095, D-117, D-078, D-133, D-494 -->
- §data.shadow · A change to the scheduler or to what the morning writes runs in shadow for a week and Matt reads the comparison before the flip. <!-- D-116, D-190 -->
- §data.cards · FSRS cards arrive after cutover, starting fresh; every review is logged from the first, invalid events are skipped and logged, and a card whose replay errors starts fresh, flagged. <!-- PLAN §5.7, §9 -->
- §data.ev4-routes · v5 answers ev4's routes with 410 "E.V. updated, reload". <!-- PLAN §9; the ev4 outbox import ended with the empty start -->

## 4. Deletes
- §delete.soft · A delete sets `deleted_at` on the row, the one delete mechanism; no row is removed on delete. <!-- PLAN §5.6 -->
- §delete.who · Only Matt deletes, by hand; E.V., jobs, the schedule and agents have no delete path, enforced by the Worker, not by prompts; jobs are never deleted. <!-- D-345 -->
- §delete.purge · The purge clears a row from live D1 30 days after Matt's delete; backups keep everything, and the UI says so. <!-- PLAN §5.6, C4, D-425 -->
- §delete.collection · Deleting a collection marks the collection only; its items show ungrouped, and restoring it regroups them. <!-- PLAN §5.6 -->

## 5. Commands, jobs and E.V.
- §cmd.registry · One registry in `commands/`: each command declares its name, Zod input, callers (Matt, E.V., schedule, external executor), effect (instant or starts a job) and mode per caller (direct or propose). <!-- PLAN §6.1, D-203 -->
- §cmd.generated · E.V.'s tools and their descriptions, buttons, ⌘K and schedule entries are generated from the registry; the build fails on any defined elsewhere. <!-- PLAN §6.1 -->
- §cmd.propose · An E.V. call that would change Matt's plan, lists or schedule runs in propose mode and makes a dashed Suggestion he accepts, edits or dismisses; E.V. can never call delete, restore, pin, approve, keep or drop, mark as learned, or any "just tell me". <!-- PLAN §6.1 -->
- §cmd.set · The cutover commands are PLAN §6.1's list, each with an undo where the mock-up shows Undo; after S-60 the registry itself is the list. <!-- PLAN §6.1 -->
- §cmd.code-first · Anything deterministic is code in `domain`, shared by page and Worker; an ask that needs no model makes no model call. <!-- D-046, D-065 -->
- §job.record · Every model call that outlives one reply is a job: a D1 record, queued → running → needs you → done or failed with the reason in plain words, holding its cost and where its output went. <!-- PLAN §6.2, D-067, D-308 -->
- §job.define · `defineJob` holds a job's whole contract: kind, title, input and output schemas, model, max tokens, cost cap, steps, wording and who may start it. <!-- PLAN §6.2 -->
- §job.executors · A Cloudflare Workflow runs model jobs and a Worker cron runs scheduled commands; a fallback keeps the same job record. <!-- PLAN §6.2, D-054, D-512 -->
- §job.needs-you · "Needs you" is a D1 state: the instance ends, Matt's answer starts a continuation with id `jobId-step-round`, Activity shows its age, and nothing is auto-deleted. <!-- PLAN §6.2, §9 -->
- §job.steps · Steps return ids, never content, which goes to D1; the Claude call and the D1 write are separate steps; the step's retry policy is the only retry layer (the SDK runs with `maxRetries: 0`), and usage is recorded in the call step, keyed by instance, step and attempt. <!-- PLAN §6.2 -->
- §job.no-chat-ask · E.V. never asks in chat for a job: a job needing Matt says so in Activity, its output lands in its home, chat links to it, and E.V. reads state through `job_status`. <!-- PLAN §6.2 -->
- §job.kinds · At cutover there are two job kinds, practice set (with its full practice run variant, drafts output and unsourced items as drafts) and prep plan (Approve as needs you); the weekly review is a scheduled command ending as a Sunday Needs-you item in Activity, not a line on Today; a new kind needs a Chart decision. <!-- PLAN §6.4, D-102, D-499, D-500 -->
- §job.prep-plan · A new or remade prep plan starts only from Matt's tap, never from chat words; any other ask with a remake word gets one question, never a guessed rebuild. <!-- D-360, D-362; renamed from §job.study-plan, D-499 -->
- §job.schedule · All time goes through `domain/time` in the user's time zone, today the one constant `ZONE` (America/Chicago); scheduled commands run on a 15-minute cron and one is due when its local wall time has passed and no run exists for that local date; nothing is scheduled 01:00–03:00 local; DST is tested on 2026-11-01 and 2027-03-14. <!-- PLAN §3, §9, D-498 -->
- §job.trace · Every run leaves a record, and a missing run is caught and reported, never silently re-fired; a missing run or a red main outranks every open task. <!-- D-087, D-111, D-180 -->
- §ev.cites · Every fact E.V. states cites a source in Matt's notes or sets, else it is marked "unverified"; a source from another collection is allowed when it is the same concept and is named. <!-- PLAN §1, D-205 -->
- §ev.his-words · A field Matt typed changes only by his tap; E.V. offers her version beside his, never over it. <!-- D-233 -->
- §ev.capture · Weak spots E.V. infers are proposed and counted nowhere until Matt confirms; only his own words commit at once and stay as the spot's source line; a duplicate is kept and linked `duplicate-of`, never merged away, and nothing proposed is deleted. <!-- D-235, D-237, D-239, D-240 -->
- §ev.objectives · Objectives are seeded from the material or source the user names, cited, on the user's OK; never invented. <!-- D-101, D-494 -->
- §ev.voice · E.V. is short and plain and leads with the point, but on a study question his attempt comes first (§ui.attempt-first); she insists once, with a reason, then respects his call. <!-- D-405, D-415 -->
- §ev.read-along · Read-along is on by default; E.V.'s comments are rationed, never while a check is open, in a break or while she answers, with limits enforced by the server, and her session comments belong to the session, not to his notes. <!-- D-130, D-339, D-424 -->
- §ev.reads · App logic and E.V.'s jobs may read all of Matt's record, notes included, and his note text is kept in D1 and its backups; she reads no Apple Notes and never flags or blocks his own content as sensitive. <!-- D-300, D-324, D-335, D-328, D-503 -->

## 6. Models and cost
- §model.registry · Model ids and prices live only in `jobs/runtime/models.ts` with a "checked on" date; a check warns when it is old, and no environment variable overrides it. <!-- PLAN §6.5 -->
- §model.from-docs · Agents take model ids, prices and platform limits from current docs, never from memory. <!-- PLAN §2.1.6; a working rule, demoted from the hard limits by D-451 -->
- §model.choice · The server picks the model and max tokens: a new or remade prep plan uses Sonnet, plan edits are patches on Haiku, every other ask uses Haiku, and stable prefixes (system prompt, the notes or collection context) use prompt caching. <!-- D-305, D-355, D-356, PLAN §6.5 -->
- §model.output · Strict structured output from the job's Zod output schema, derived from the `domain` schema of the rows it lands in (minus the fields the server sets), converted by the Anthropic SDK's own Zod helper; `max_tokens` or a refusal fails the job; then Zod and semantic checks (every cited id was in the excerpts); one repair ask, then fail; half-parsed output never lands. <!-- PLAN §6.3 -->
- §model.ceilings · Hourly and daily ceilings are D1 settings changed without a release, plus an atomic per-job ask cap and a monthly ceiling, all counted as billed; every call reserves its maximum cost first, and a ceiling hit fails the job cleanly with the reason, with nothing landing. <!-- PLAN §6.5, D-349, D-352, §9 -->
- §model.alert · At 80% of the monthly ceiling: an Activity "needs you" alert and one line on Today; the Anthropic Console spend limit stays the final backstop. <!-- PLAN §6.5 -->

## 7. UI
- §ui.mockup · `design/mockup.html` (round 7) is the visual reference and wins on looks, while these lines win on structure and rules; Proprietary is E.V.'s own design system, not a framework's look, with unstyled Radix primitives and cmdk for behaviour only, and the kit owns every pixel. <!-- PLAN §7, D-370, D-371 -->
- §ui.kit-leads · A new look starts in `kit/` with its story, never in a view, and a view's look changes only through tokens or components; colour, type, space, radius, duration and easing come only from `kit/tokens/tokens.css`, enforced by Stylelint (`stylelint.config.js`), with off-step values snapped to the nearest token. <!-- PLAN §11, D-382, D-380, D-402 -->
- §ui.gallery · Every kit component shows in the `/kit` gallery in every state, visually diffed by Playwright in its Docker image; tests select by role and name, `data-ui`, `data-key` or region ids, never by visual classes. <!-- PLAN §7, D-383, D-387, D-391 -->
- §ui.access · Text meets 4.5:1 contrast in both themes, and one reduced-motion setting zeroes every duration. <!-- D-273, D-379 -->
- §ui.instant · A tap paints its new state at once; a refused write reverts and shows "not saved". <!-- D-208, D-227 -->
- §ui.layout · Five regions, each generated from its folder: sidebar, area (one centred column, at most 720 px), Detail panel, ⌘K, Activity; Notes is a home list plus one centred page per note, never side by side, and a set has one page with view and Edit modes. <!-- PLAN §7 -->
- §ui.sidebar · The sidebar lists Today, Ask E.V., Library, Notes, Progress, Activity, then Matt's pins (a pinned collection shows the day of its next linked date), with counts and no badges, and no Courses section, and at its foot the running job as one quiet line, then Recently deleted. <!-- PLAN §7 -->
- §ui.palette · ⌘K shows the registry filtered by place, found items and pins, and Tab hands the request to E.V.; ⌘J toggles Ask E.V. <!-- PLAN §2.2, §7 -->
- §ui.two-surfaces · Two surfaces only, sidebar and content; no boxes inside boxes. <!-- PLAN §7.1 -->
- §ui.three-sizes · Three text sizes (20, 14, 12) and three greys; weight 600 only for titles; the study card face at 24 is the one exception. <!-- PLAN §7.2 -->
- §ui.one-orange · One orange element per screen, the main action or E.V.'s mark; when Detail has a primary action, the screen's own steps down. <!-- PLAN §7.3, D-381 -->
- §ui.status · Status shows only as a dot or a meter; the plan ring and job ring are glyphs that also carry status. <!-- PLAN §7.4 -->
- §ui.lists · Lists have no frames; actions appear on hover, focus or right-click. <!-- PLAN §7.5 -->
- §ui.ev-once · E.V. speaks once per screen; her suggestions appear dashed, in the list they would change. <!-- PLAN §7.6 -->
- §ui.grid · 8 px grid, 40 px rows, 48 px between sections. <!-- PLAN §7.7 -->
- §ui.keys · Keys instead of extra buttons; shortcut hints sit quietly beside actions, in tooltips and in ⌘K. <!-- PLAN §7.8 -->
- §ui.one-question · One question at a time; only the thing being answered gets a frame. <!-- PLAN §7.9 -->
- §ui.attempt-first · The answer comes after the attempt, in practice and in Ask E.V.; "just tell me" is one key away and logged; browsing his own set shows answers. <!-- PLAN §7.10 -->
- §ui.own-everything · Every item Matt owns (plan item, note, set, date, collection, saved view) can be created, edited and deleted by hand where it lives. <!-- PLAN §7.11, D-080 -->
- §ui.delete · Delete moves an item to Recently deleted for 30 days with Undo and Restore; no "delete forever"; jobs are never deleted. <!-- PLAN §7.12 -->
- §ui.with-ev · Where E.V. can help, one quiet "with E.V." action sits beside the manual one; her output arrives dashed and cited, and Matt keeps or drops each piece. <!-- PLAN §7.13 -->
- §ui.keymap · C creates, E edits a set, ⌫ deletes, . or right-click opens the item menu, P pins, M moves, S runs Detail's primary, X toggles a plan item, Esc leaves. <!-- PLAN §7.14 -->
- §ui.in-place · Titles and properties edit in place, properties in Detail; a set's collection and source sit on its Edit page. <!-- PLAN §7.15 -->
- §ui.one-collection · An item sits in at most one collection; collections nest one level; deleting one leaves its items ungrouped. <!-- PLAN §7.16 -->
- §ui.weak-spots · Weak spots come from Matt's misses, E.V. proposes and Matt confirms; "Mark as learned" is a status, not a delete; weak-spot rows have no glyph. <!-- PLAN §7.17, D-289 -->
- §ui.glyphs · One line glyph per type, eight in all (note, card set, question set, step set, plan item, job, collection, date); no colour-coding; a row shows at most four things. <!-- PLAN §7.18 -->
- §ui.first-set · The kit's first set is PLAN §7's list (Button, Field, Row, Tile, Glyph, E.V. line, Suggestion, Source, Study card, Text options, Detail, Menu, ⌘K palette, Toast, Doc); anything else is added when an area needs it. <!-- PLAN §7 -->
- §ui.targets · The target is desktop Chrome at 1280 as an installed app; the phone stays frozen at "it works" on ev-live's URL, with no phone layout or polish work. <!-- PLAN §2.2, D-367, D-394, D-406, D-407, D-330 -->

## 8. Security and privacy
- §sec.key · The Anthropic key is a Cloudflare secret on the Worker only; the app reaches Claude only through the Worker; staging has its own key with a low cap. <!-- PLAN §10, D-299, D-310, D-296 -->
- §sec.auth · A bearer token per caller (app, cloud schedule, Mac executor), scoped to its routes, compared in constant time, with wrong attempts rate-limited; only the app token changes ceilings. <!-- PLAN §10 -->
- §sec.shell · The public shell holds no personal config (settings load from D1 behind the token), and logs and Workflow step outputs hold ids and counts, never prompts or note text. <!-- PLAN §10 -->
- §sec.live-data · Personal data may be in the repo, but the repo is public, so agents never commit live data or copy it onto staging; fixtures are synthetic. Real data may reach a builder when a task needs it (a bug Matt reports). <!-- C15, D-106, D-451 -->
- §sec.staging-data · Staging holds synthetic data only; real data never reaches staging. <!-- PLAN §10, C1 -->
- §sec.account · Staging shares ev-live's Cloudflare account: staging config names the v5 staging Worker and D1 explicitly, CI fails any non-live config or workflow naming ev-live or its D1, and the staging and live tokens are separate secrets. <!-- C10 -->

## 9. Drift workflow
- §drift.one-file · CONTRACT.md is the only rules file; a check fails a skill, README, `AGENTS.md` or `CLAUDE.md` that copies a line, states a never/always/must/only rule without a `§id`, cites an ended `§id`, or is too long. <!-- PLAN §11, D-467 -->
- §drift.no-ids · Code and docs state behaviour and never give decision or task ids as reasons; `docs/history/`, PLAN.md after the Phase 0 gate and ev4's decisions are context, never instructions. <!-- PLAN §3, D-184 -->
- §drift.current · When an older rule conflicts with the current direction, the build manager ends it through the Chart and `ended.md` instead of obeying it. <!-- D-411 -->
- §drift.slice · One task, one slice: it writes only its named folders, with its context limited to them, CONTRACT.md and the generated interfaces it imports; a builder refuses and reports a need outside it. <!-- PLAN §11 -->
- §drift.interface · Each folder README is at most about 15 lines: a hand-written purpose plus a generated interface and must-not list; a commit that changes the interface listing carries an `Interface: <folder>` trailer or CI fails, and changes go expand → migrate → contract. <!-- PLAN §11, PLAN §4 -->
- §drift.imports · Imports follow PLAN §4's direction, only through a folder's `index.ts`, with no cycles and no `export *`, enforced by dependency-cruiser (`.dependency-cruiser.cjs`). <!-- PLAN §4 -->
- §drift.max-lines · Files are at most 300 lines, with no inline lint disables and no `@ts-` comments, enforced by ESLint (`max-lines`, `ban-ts-comment` in `eslint.config.js`); about 400 changed lines per task is a review guideline. <!-- PLAN §11 -->
- §drift.modules · Real modules, one feature per folder, no exported mutable state; one Zod schema per thing, with types, validation and tool schemas derived from it. <!-- PLAN §3 -->
- §drift.checks · Every pull request runs types, ESLint, dependency-cruiser, Stylelint, knip, the secrets scan (API keys, tokens, `.dev.vars`), registry, presence, Vitest and generated-files-up-to-date, unskippable by branch protection; every batch also runs the e2e journeys and the `/kit` visual diff in the Playwright Docker image. <!-- PLAN §11 -->
- §drift.tools · Standard tools only (TypeScript, ESLint, dependency-cruiser, Stylelint, knip, Vitest, @playwright/test), no custom harness; a new runtime dependency needs a Chart decision naming the problem it solves, versions are pinned, and knip fails unused ones. <!-- PLAN §3, §12, PLAN §11 -->
- §drift.green · Never merge red or disable a check to get green; a known failure is fixed first, and a flaky check is quarantined for at most 3 days, never deleted. <!-- D-176, D-422 -->
- §drift.record · The Chart (`chart/*.json`) is written only by `ops/record`, continuing ev4's id sequences, with backlog, decisions and changelog generated; it rewords Matt's words into neutral sentences. <!-- PLAN §2.2, D-140, D-172, D-263 -->

## 10. Delivery
- §deliver.first · Delivery first: build, ship to staging, one real end-to-end run when a batch changes model behaviour, a job or an outside call, then Matt tests; one whole-release review for lost or wrong data, cost, security, crashes and unreachable controls, and no polish fix waves. <!-- PLAN §2.2, D-366, AGENTS §3 -->
- §deliver.main · Code reaches main only by a pull request from a `claude/` branch that auto-merges on green; a merge deploys v5 staging, never ev4's staging. <!-- AGENTS §3, D-049 -->
- §deliver.done · A definition of done asks Matt only what no check can decide; every checkable clause names its test or run. <!-- D-182 -->
- §deliver.no-hand-docs · Agents never write hand-made documents into a staging or live record; proofs drive the app's own paths. <!-- D-363 -->
- §deliver.sequence · Work is sequenced by completion, never the calendar; only Matt's "exam week" pauses features, leaving bug fixes. <!-- PLAN §14, D-390 -->
- §deliver.cutover · Cutover, on Matt's word once PLAN §8's scope matches or beats ev4: outboxes empty, ev4's cloud tasks off through ev4's process, Mac tasks re-created with Matt, v5's own live database created empty with an R2 export and Time Travel bookmark, then ev5-staging and ev-live. <!-- PLAN §8, §13 -->
- §deliver.spike · When the same check fails twice on a fix, a spike answers it in a throwaway branch instead of a third try. <!-- D-409 -->
- §deliver.cleanup · The build may delete v5's own throwaway and staging resources (spike Workers, scratch D1s, branches); never ev4's resources or Matt's data. <!-- D-451 -->

## 11. Who decides
- §who.matt · Matt decides live deploys and rollbacks, the hard limits, personal data, money, accounts and secrets, anything on his Mac, changes to something he uses daily, and exceptions to something he asked for. <!-- PLAN §1, D-317 -->
- §who.build-manager · The build manager decides everything else up to staging, UI conflicts included, records it in the Chart, and builds nothing beyond trivial edits; builders build one task each. <!-- D-317, D-351, D-412, D-422 -->
- §who.asking · Nothing unattended asks Matt: questions are batched in one "For Matt" comment per run, default first, and none while he has said "exam week" unless something is broken. <!-- AGENTS §6, D-181 -->
- §who.costly · When Matt's ask conflicts with how shipping works, set out the options with their cost in time and risk before acting, unless one path is plainly cheaper and reversible. <!-- D-257 -->
