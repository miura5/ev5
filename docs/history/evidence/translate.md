# ev4 "translate" items: what to translate and what to replace

Scope: the five items the v5 plan lists to translate from ev4. The repo was read-only; I ran no code from it.

**Method caveats (checked):**
- `/workspace/ev4` is a **shallow clone with 50 commits**, all from Nov 1–2 (`git rev-parse --is-shallow-repository` → true). Every path's `git log` returns one commit, B-669 (the graft point). So the git-subject method gives nothing, and **all bug counts below come from chart/tasks.json**.
- chart/tasks.json has 691 entries: 334 task, 179 bug, 178 request. I matched regexes on `title`, `words` and `reworded` (and `notes` for Canvas), then read each hit by hand to drop false matches. For example, "canvas" also matches the claude.ai design canvases, and "token" also matches the Claude token ceilings. The script is /tmp/arch/translate/q.py.
- Bug reports describe symptoms, not files, so some counts involve judgment; I name the ids so they can be checked.

---

## 1. The record (Chart)

**Verdict:** carry the data over as it is. Write a new, small writer (about 300–500 lines). Do not translate chart.mjs: about 70% of it is v4 build ceremony.

**(a) Size**
- tools/chart.mjs is 2,755 lines; tools/chart/record.mjs 83; tools/chart/render.mjs 362. Total 3,200, plus test/chart.test.mjs at 2,012.
- The data is 1.43 MB:
  - tasks.json: 691 entries, ids B-00..B-690, contiguous.
  - decisions.json: 382 entries.
  - deploys.json: 367 entries (it feeds CHANGELOG.md).
  - rules.json: 6 entries, R-01..R-06. Only R-02 and R-04 are still in force.
  - views.json: ids of claude.ai artifacts, retired by D-172 (views.json `retired`).
- Entry point: `main()`, tools/chart.mjs:2740. The command table is at :2587. Commands: backlog, lint, inbox, quarantine, log, report, commit, brief, ship, trace, rollback, plan.

**Decision count (checked).** There are 382 decisions, contiguous from **D-044 to D-425**. DECISIONS.md:4-5 says "D-001 to D-043 are in the v2 doc's decision log", so they are not in the repo at all. "425+" counts ids, not entries.
- Status: 322 accepted, 53 superseded, 4 proposed, 3 revisit.
- Kind: 336 decisions, 46 tenets.
- 51 of the 53 superseded entries are named in some `supersedes` list. **D-361 and D-364 are superseded but no decision names their superseder** (a dangling link).
- The record also cites 21 `claude.ai/artifact/…` links (design docs, overview docs). That history sits outside the repo and lasts only as long as the artifacts do [unconfirmed].
- If "history must carry over intact" has to include D-001..D-043, someone needs to find the v2 doc [unconfirmed where it is].

**(b) What it does.** It is an append-and-update JSON record of tasks, decisions, deploys and rules. On every write it:
1. regenerates BACKLOG.md, DECISIONS.md and CHANGELOG.md (render.mjs `generatedFiles`, :190),
2. lints the record (render.mjs `lintChart`, :226),
3. then `git commit` and `git push` (chart.mjs `record()`, :2699).

On top of that it carries the v4 release machinery.

**Line breakdown by section header (checked):**

| Part | Lines | Keep in v5? |
| --- | --- | --- |
| header/imports | 1–145 | — |
| log/report (also log deploy and log rule) | 221–633 (~413) | core |
| backlog/lint/commit and argument parsing | in 2547–2755 | core |
| **Docs reads** (parses claude.ai doc XML) | 146–220 | ceremony |
| **Matt's words / inbox** (pulls his words out of Claude Code transcripts and Board comments; sync/push) | 634–902 (~270) | ceremony |
| **ship + ship it** (rules gating, deploy calls, verify, tags, Ship-it job refusals) | 903–1497 (~595) | ceremony |
| **trace** (builder job traces) | 1498–1625 | ceremony |
| **kickoff** | 1626–1824 | ceremony |
| **brief** | 1825–2107 (~283) | ceremony |
| **plan** (design-doc hand-off read from the transcript) | 2108–2304 | ceremony |
| **rollback** | 2305–2546 (~242) | ceremony |
| quarantine | small | ceremony |

That is about 1,950 lines of ceremony, about 70%.

**(c) Bug history.** 11 bugs match chart-tool keywords (`chart\.mjs|chart/*.json|BACKLOG|ship (staging|live)|rules\.json|ROLLBACK_KEEP|trace|inbox|patch tag`). **10 of the 11 are in the ceremony; only B-174 touches the record core**, and that one is a test-fixture issue. The record core itself (load, save, next id, render) has had none.
- B-175: live deploys left without patch tags.
- B-640: a shallow clone has no tags, so builds get stamped `+untagged`.
- B-641: a live deploy that was never recorded (led to `ship live --record-past`).
- B-425: a docs-only commit forced a new full check and a new OK.
- B-268 (open): ROLLBACK_KEEP omits DECISIONS.md.
- B-677 (open): ship live needs `list_triggers`.

**(d) Coupling (checked).** chart.mjs imports:
- core/deploy.mjs, core/transcript.mjs, core/actions.mjs, core/validate.mjs, core/migrate.mjs, core/evcore.mjs, core/cli.mjs and core/verifystate.mjs;
- tools/guard.mjs, tools/build.mjs (BOOKKEEPING, INERT), tools/record-past.mjs and tools/pwa-app.mjs.

Other links: lint reads spec/ev.spec.json and the test sources (`testTexts`, :2573). tools/hooks.mjs, tools/build.mjs, tools/pwa-system.mjs and 10 test files import chart.mjs. record.mjs and render.mjs are almost free of this: their only imports are node built-ins and transcript.mjs.

**(e) Recommendation.** Treat chart/*.json as **data to carry**, not code to translate.
- v5 can read tasks.json and decisions.json as they are. The schema is simple and stable. The common shape is `id, kind, title, dod, milestone, status, depends, notes, commit, source, board`, plus `words, reworded, triage, reportedAt` on reports.
- The v5 writer only needs: load/save (written with indent 1 and no trailing newline, record.mjs writeJson), the next id, add/update a task or decision, and the three renders. Then id/link lint, and optionally the commit.
- Keep the field names and the id formats (`B-nn` padded to at least 2 digits, `D-nnn` to 3; record.mjs nextTaskId and nextDecisionId), so ev4 history and v5 entries share one sequence.

What would make a translation drift-prone: rules.json gating, the deploys/CHANGELOG coupling to core/deploy.mjs and the tags, transcript scraping (`--from-chat`) that depends on the Claude Code transcript format, and claude.ai doc parsing. All of these are tied to v4's release process.

Decide explicitly:
- whether deploys.json continues, or is frozen as v4 history and v5 starts its own changelog;
- whether `board`, `triage` and `views` are read-only legacy fields.

---

## 2. Tokens (json → css)

**Verdict:** carry the values over, not the generator.
- The plan's premise is off: **ev4 has no JSON-to-CSS token generator.**
- Carry the R4 colours and the type/space scale over as a static tokens file (JSON or CSS custom properties).
- Drop genTheme and the LCH recipe tuner. Keep the contrast control only if Matt uses it [unconfirmed]; it would be a small mix function.

**(a) Size**
- page/theme.js, 412 lines: a runtime colour generator.
- page/ds/tokens.css, 197 lines with 83 custom properties: spacing, type, radius, motion. **Hand-written.**
- Rest of page/ds: 3,084 lines total, of which base 59 and gallery 70; the rest is components, patterns and views CSS.
- tools/build.mjs (733) only concatenates and inlines files: `LAYER_ORDER` at :55, the layers at :58-63, and theme.js inlined into the head at :539-566.
- tools/token-audit.mjs (135) is a lint.

**(b) What it does.**
- theme.js `apply()` (:372) runs before first paint and writes the colour custom properties for light and dark.
- The default theme is **a literal hex table, `R4`** (theme.js:116-123, "r4.css's values word for word"). Contrast mixes it (`r4Theme`, :144).
- `genTheme` (:165) is the old Ember LCH path, used only for "a tuner's other recipe".
- The System view's Contrast control (30/60/100) re-runs it (page/app/50-system.js:387, :460-483).
- The faint text colour is nudged in a loop until it holds 4.6:1 (:157, D-399).

**(c) Bug history.** Only 3 bugs match (`theme|contrast|colou?r|tokens\.css|token lint|Proprietary token`):
- B-594: kind badge colours differ from the sidebar dots.
- B-600: H1 and H2 the same size (a notes type scale was missing).
- B-603 (open): spec.ui.look.theme describes the retired look.

**The cost was churn, not bugs.** 63 decisions mention token/theme/colour/Proprietary. The design-token ones run from D-268 through D-402 in about two weeks: LCH theme (D-268), Proprietary system (D-370–D-384), neutral Linear look (D-392), budget changes (D-398, D-399), snapping to tokens (D-402). D-409 records that "only 19 of about 734 !important overrides" could be stripped.

**(d) Coupling.**
- theme.js is self-contained (an IIFE on `root`).
- Its consumers: build.mjs inlines it, 50-system.js uses it, and so do test/harness/contrast.cjs, test/contrast.test.mjs, tools/token-audit.mjs and tools/pwa-icons.mjs.
- spec.ui.look.* is stale (B-603).

**(e) Recommendation.** A token file plus a tiny build step, or plain CSS variables, covers it. Style Dictionary is the generic import if multiple outputs are ever needed [verify maintenance]. For one PWA it is overkill.

What would make it drift-prone: copying genTheme or the legacy alias names (`--sem-*`, `--do`, `--att`… listed in the tokens.css header).

---

## 3. D1 queries

**Verdict:** translate the protocol, not the queries.
- **There are no domain queries to translate.** D1 is a generic document store, and all domain logic runs client-side over the whole record in memory.
- Build "typed repositories" as new code over the existing `docs` table, typed by spec/schemas/*.json. Keep `docs(c, id, data, at, v)` unchanged so v5 reads ev4 data without migration.

**(a) Size**
- The schema, pwa/schema.sql (45 lines), has 6 tables:
  - `docs(c, id, data TEXT JSON, at, v)` with PK (c, id);
  - `claude_usage`, `claude_reads`, `claude_settings`, `claude_plan_asks`, `system_docs`.
- The Worker side is about 660 lines: worker.js 175, runapi.js 276, backup.js 88, guard.js 32, system.js 44.
- The page side is pwa/bridge.js, 1,278 lines.
- core/d1backup.mjs is 93 lines.
- There are **about 30 SQL statements in all** (`grep prepare(`). Most are `SELECT … FROM docs WHERE c=? AND id=?`, optimistic `UPDATE … WHERE v=?`, `INSERT`, and `WHERE at > ?` for sync (worker.js:82).

**(b) What it does.**
- `GET /api/db?since=` returns changed docs (worker.js:76-88).
- `PUT /api/db/<c>/<id>?if_version=` saves a whole document, refused with 409 when stale (worker.js:90-140).
- The run API (`list/get/batch/collections`) has all-or-nothing batches of 1–50 writes and **never deletes** (runapi.js:1-11). Note that D-425 now allows a 30-day purge.
- Documents are stored as canonical JSON (B-398).
- bridge.js emulates claude.ai's `window.claude.use('db')` ArtifactData API. It loads the whole record into memory, polls every 10 s, and keeps an IndexedDB copy plus a notes outbox (bridge.js:1-22).
- 36 collections (spec.collections; 2 retired, 2 dead per their notes), each with a JSON schema in spec/schemas/.

**(c) Bug history.** 9 bugs match (`D1|run API|bridge|409|if_version|offline|sync|R2|canonical|cursor`). About 6 are really in this layer:
- B-389: page saves were last-write-wins until if_version was added.
- B-397: run API cursor decoding and retry-after-write.
- B-398: non-canonical JSON made hashes differ.
- B-410: notes outbox (refused entries, duplicates on adopt, backoff).
- B-424: restore drill.
- B-676 (open): run-API staging check fails.

**(d) Coupling.**
- The page's model (page/app/04-model.js `write()` at :47) speaks the ArtifactData shape through the shim.
- Validation is pwa/notes.js → core/validate.mjs plus notes.schema.json, and only for notes on the Worker side.
- The ids, collections and version semantics are mirrored in core/runapi-client.mjs and core/d1backup.mjs.

**(e) Recommendation.**
- The things worth porting are the **version/if_version protocol, the canonical JSON, the delete rules, the 36 schemas, and the bridge's offline outbox semantics** (stale offline note saves become `'<title> (earlier)'` copies, D-326).
- A whole-record load is fine at this size: 515–563 docs (B-21, B-98 notes).
- Drizzle or Kysely for D1 is an option only if v5 normalizes tables [verify D1 support/maintenance]. With a JSON document table, a small typed wrapper is less code.

What would make it drift-prone: inventing per-entity tables and dropping the `docs` key layout. That breaks the R2 export shape (pwa/backup.js `manifestOf`), core/d1backup.mjs restore drills, and reading ev4 data without migration.

---

## 4. Canvas read-only sync

**Verdict:** translate a reduced core. The rules and the fetch scripts are small, stable and E.V.-specific. Leave the orchestration out.

**(a) Size**
- scripts/canvas/*.js: 125 lines (dates 32, files 34, texts 49, poll 10).
- core/canvas.mjs: 131 lines (template filling, unwrap, changedFiles, canvasRaw).
- core/canvas-rules.mjs: 286 lines (`normalizeCanvas`, change detection, Central dates).
- Plus `officeText` and `pdfText` in core/library.mjs (:321, :411, about 200 lines), the cli `canvas-script` command (core/cli.mjs:641-690), and the steps `canvas-brief` and `canvas-sync` (core/steps.mjs:695-740, :1055-1075).

**(b) What it does / what runs it (checked).**
- The `evening-mac` pipeline (spec.pipelines.evening-mac, lane `mac`, agentCalls `mcp__remote-devices__Claude_Browser__`) is a **scheduled Claude task on Matt's Mac**.
- That task prints each part's script and runs it with `javascript_tool` in Matt's signed-in Canvas tab (the school's Canvas host, spec.registry.canvas).
- The scripts do same-origin GETs only, with `credentials: 'same-origin', redirect: 'manual'`. A redirect or 401 → `signed-out`, and they never sign in (scripts/canvas/dates.js:10-15). This meets the hard limit: there is no token.
- Results are padded to 90 KB so the browser tool saves them to a file (poll.js:9). Then `unwrap` → normalizeCanvas → fold.
- texts.js dynamic-imports pdf.js 4.4.168 from cdnjs inside the Canvas tab (spec.constants.library.pdfjs) [verify still current].

**(c) Bug history.** Of 38 "canvas" matches, most are design canvases; about 7 are real Canvas tasks (B-21, B-42, B-98, B-160, B-317, B-607, B-189). **Bugs in the sync code: 0.**
- B-189 is a prep-rule bug in the data that came from Canvas, not in the sync.
- The failures were operational: the scheduled task's folder access (B-21 notes; B-98: "repository is not checked out", fixed by Matt approving folder access in the desktop app).

**(d) Coupling.**
- The scripts receive E.V. core functions injected as source text (`/*@FN:officeText*/`, `EV[name].toString()`, core/canvas.mjs:13-27).
- Their parameters come from spec.courses and spec.registry.canvas through `EV.configure(spec)` (:29-33).
- The output goes into the run/step/fold pipeline (steps.mjs).

**(e) Recommendation.** Port four things:
1. the three GET scripts,
2. normalizeCanvas and the change detection,
3. the course and library rules as data,
4. the officeText/pdfText readers.

Drop the `Function.toString` injection: bundle the scripts instead. Re-decide the orchestration (scheduled Claude task plus javascript_tool plus pad, file and unwrap) on its own merits; it is the fragile part.

What would make it drift-prone [inferred]: the scripts fetch one page with `per_page=100` and do not follow `Link` pagination (dates.js planner/announcements; files.js:18 modules). That truncates silently if a course passes 100 items.

---

## 5. Notes editor

**Verdict:** keep the stored format and translate core/notes.mjs's model layer. **Replace the contentEditable view and controller with ProseMirror/Tiptap**, using a schema that mirrors the blocks.

**(a) Size**
- page/app/25-notes.js: 2,078 lines.
- core/notes.mjs: 1,003 lines. It is a pure factory with no imports. It exports the model (noteBlock/Blocks/Runs, TidyRows, noteText, TitleOf, noteDoc, noteHtml, FromText, ParseHtml/paste) and the editing ops (noteInsertText, Enter, Join, SetType, Indent, SetMark, Shortcut…) (:967-1002).
- core/note-images.mjs: 140 lines (image blocks, rows, move, resize).
- pwa/notes.js: 16 lines (Worker validation). pwa/images.js: 61 lines (R2 under `note-images/`).
- The offline outbox is in pwa/bridge.js (45 outbox/IDB references).
- Tests: notes-editor.test.mjs 467, notes.test.mjs 624, and **test/harness/notes.cjs 4,156 lines**. That harness is the best behaviour specification for a replacement.

**(b) What it is (checked).**
- **Yes, it is a custom contentEditable** (`body.contentEditable = 'true'`, 25-notes.js:297).
- It uses `beforeinput` interception (:1151), then reads the DOM back into blocks (`syncFromDom`, :1212), with its own undo/redo, its own selection model `{a,f}` positions, and IME composition handling (4 references).

**Features Matt relies on:**
- **Formatting:** P, H1–H3, bulleted, numbered and checklist lists; indent up to 6; B/I/U/S; Quip shortcuts; markdown-style triggers (`# `, `- `, `1. `, `[] `) (B-402 dod).
- **Links:** http(s) only (notes.mjs `HREF`).
- **Paste:** sanitized; HTML is never inserted.
- **Images:** an R2 key block with width and alt; paste/drop, drag, resize (B-653).
- **Two-column rows:** an image beside text (B-654, D-418).
- **Offline:** an IndexedDB outbox, with stale saves kept as an "(earlier)" note (B-404, D-326).
- **Autosave:** 800 ms debounce.
- **"Ask E.V." on a selection** (:916).
- **Read-along:** core/sessions.mjs `readAlongAsk` (:763), page/app/64-ev-study-sessions.js:471-584, and pwa/claude.js:7, :323-330. The `claude_reads` table holds one row per note `{h = length+hash, at}`, refuses repeats with 409 and anything within 75 s with 429. Read-along needs only the note's plain text (`noteText`), so it **does not depend on the editor technology**.

**Stored format (checked).** JSON blocks, **never HTML and not markdown** (spec/schemas/notes.schema.json: "never HTML"; core/notes.mjs:6-10).
- Document: `{schema:1, writer:'page', at, source, createdAt, title, course, label?, blocks[], editedAt?, earlierOf?, archivedAt?, discardedAt?}`.
- Block: `{type: p|h1|h2|h3|ul|ol|todo|img, runs:[{text, b?, i?, u?, s?, href?}], checked?, indent? 1–6, row?, col? 0|1, key?, width?, alt?}`.
- **Lists are flat items with an `indent` attribute, not nested lists**, and rows are flat blocks with marks. Limits: 4,000 blocks, 400 runs, 20,000 characters per run, 256 KB per document.

**(c) Bug history.** 27 bugs match `\bnotes?\b|read-along|claude_reads`; I sorted them by hand.

*Editor core (25-notes.js / notes.mjs): 6 bugs, 4 done and 2 open, all reported Oct 27–30, within days of going live on Oct 26 (B-409 notes, D-340). None lost data.*
- **B-437:** Enter at the end of a line ending in a space made a zero-height line. A classic contentEditable whitespace-collapse bug.
- **B-474:** the selection highlight bands under list markers (contentEditable rendering).
- **B-440:** the placeholder overlapped typed text.
- **B-451** (open, half): a pasted H1 gets no top spacing.
- **B-528** (open, half): "On this page" ignores headings.
- **B-600:** H1 and H2 the same size.

*Open review backlogs:* B-656 and B-657, 10 items between them. Examples: an image inserted during upload lands at the old position; a canonical() repaint skip; deleting across columns collapses the row.

*Offline:* B-410. *Read-along:* B-429, B-430.

*Notes-adjacent session and side-chat features in 64-ev-study-sessions.js, not the editor (about 10):* B-411, B-517, B-520, B-623, B-638, B-658, B-682, B-685, B-601, and the other half of B-451.

**(d) Coupling (checked).**
- The page scripts are joined into one scope (tools/build.mjs:32).
- 25-notes.js calls `el`, `btn`, `toast`, `now` and `durFmt` (01-kit), `paneTo` and `showTab` (02-navigation), `write` (04-model), `renderFrame` and `popQuote` (90-render), and noteSession, noteTyped, held and whereNow (64-ev-study-sessions). It also uses the Proprietary Popover and Segmented components and the globals `EV_SPEC`, `EVCore` and `S`.
- In the other direction, its `NOTE` state is read in 64-ev-study-sessions.js (15 references), 90-render.js (4), 50-system.js (2) and 10-today/20-study/72 (1 each).

**(e) Recommendation.** Keep notes.mjs's pure model as the storage contract: normalization, limits, noteText, noteHtml and noteFromText. Rebuild the editing on ProseMirror (Tiptap's core is ProseMirror) [verify license: core MIT, some extensions paid; Workers are irrelevant, it runs in the browser].
- The schema maps p, h1–h3, checklist, and the b/i/u/s/link marks directly.
- `ul`/`ol` with `indent` need either a flat "list item with indent" node (simplest, and keeps the round trip lossless) or a nested-list conversion that has to be proven lossless.
- `img` and `row/col` need custom nodes or node views in any editor.
- Write a blocks ⇄ PM-JSON adapter and test the round trip on every stored note (an export of live notes) before shipping.
- **Do not use CodeMirror, or a textarea with markdown.** They lose the WYSIWYG Quip editing Matt asked for (B-396, B-653), clickable checklists, inline images, resize and columns. The stored format is not markdown anyway, so a converter would still be needed.
- BlockNote/Lexical are alternatives [verify license/maintenance].

What would make a translation drift-prone: re-implementing roughly 2,700 lines of selection, beforeinput and IME code by reference repeats ev4's class of bugs (B-437, B-474). The pure model is the part that has held up: no data-loss bugs, and the Worker validates every write.

---

## Summary table

| Item | Lines | Bug count (method) | Verdict | One-line reason | Key paths |
| --- | --- | --- | --- | --- | --- |
| Chart | 3,200 code (+2,012 test); data 1.43 MB | 11 bugs (title/words keywords); 10 in ship/tag/rollback, 0 in record core | Carry the data as is; new small writer (~300–500 lines) | About 70% of chart.mjs is v4 release ceremony; the JSON shape is simple and stable | tools/chart.mjs, tools/chart/{record,render}.mjs, chart/*.json, DECISIONS.md:4-5 |
| Tokens | theme.js 412 + tokens.css 197 (83 vars); no generator exists | 3 bugs (B-594, B-600, B-603); heavy churn, ~20 design-token decisions D-268..D-402 | Translate the values, drop the generator | The default is a literal hex table (R4); genTheme is a legacy tuner path | page/theme.js:116,165,372; page/ds/tokens.css; tools/build.mjs:55-63,539-566 |
| D1 | Worker ~660, bridge.js 1,278, ~30 SQL statements | ~6 of 9 matched (B-389, B-397, B-398, B-410, B-424, B-676) | New typed wrapper over the unchanged `docs` table; port the protocol | Generic JSON doc store, whole record held in memory; there are no domain queries | pwa/schema.sql, pwa/worker.js:76-140, pwa/runapi.js, pwa/bridge.js, spec/schemas/ |
| Canvas | ~540 (scripts 125, canvas.mjs 131, rules 286) + ~200 readers | 0 sync bugs (of ~7 real Canvas entries; failures were task setup: B-21, B-98) | Translate a reduced core; redesign the orchestration | Small, stable, E.V.-specific; the scheduled-Claude/javascript_tool/unwrap chain is the fragile part | scripts/canvas/*.js, core/canvas{,-rules}.mjs, core/steps.mjs:695,1055, spec.pipelines.evening-mac |
| Notes editor | 25-notes.js 2,078 + notes.mjs 1,003 + images 140 (+4,156 harness) | 6 editor bugs in ~5 days of use (2 open) + 10 open review items; ~10 more in session features | Keep the format and model; replace contentEditable with ProseMirror/Tiptap via an adapter | Custom contentEditable with typical bugs; the JSON block format is solid and must stay | page/app/25-notes.js:297,1151; core/notes.mjs:6-10,967; spec/schemas/notes.schema.json; pwa/claude.js:323 |
