# E.V. v5 mock-up: interaction map and trace check

**File:** `design/mockup.html` (approved by Matt on 2026-11-03, round 7; delivered as `ev5-r7.html`). Built from `reference/a-calm-desk.html`, then 4A (E.V. inline, sets as tiles), then rounds 5–7.

**What this is:** an evidence file, not opinions. Part A lists everything you can do in the mock-up. Part B traces each feature to a line in `PLAN.md` or `DESIGN-BRIEF.md`, or marks it NEW. Part C lists what the architect has to settle. Part D is the change list approval produced.

**How it was checked:**
- **Mechanical inventory.** A script pulled every action (`data-act`), command, menu entry and screen out of the file.
  - The markup uses 59 actions; the script has 61 handlers. The two extra handlers (`open-link`, `pick-link`) are built at runtime in Detail.
  - No action is missing a handler.
- **Smoke test.** Playwright opened 27 screen and panel states and clicked every visible button, each from a fresh page: 220 clicks.
  - Script errors: 0.
  - Buttons that did nothing: 2, both on purpose. *Edit view* when the view panel is already open. *Check* on an empty answer, which puts the cursor in the answer box because an attempt comes first.
- **Flow tests.** Scripted runs through creating, editing, deleting and restoring; E.V.'s drafts; study; sessions; weak spots; the weekly review; and keyboard-only use.

---

## Part A · Interaction map

### Everywhere
| Control | Effect |
|---|---|
| Sidebar: Today, Ask E.V., Library, Notes, Progress, Activity | Open the section. Counts show plan items left and jobs that need you |
| Sidebar: Pinned | Open the pinned item (collection, saved view, note, set, plan item, date) |
| Sidebar foot: running-job line | Activity, with that job in Detail |
| Sidebar foot: Recently deleted | The Recently deleted screen |
| Sidebar foot: theme, `\` | Dark / light |
| Sidebar foot: Design system, Phone | Review-only screens, not part of the product |
| `⌘K` | Palette: commands (every "New …", Recently deleted, theme), found items, pins, Go to. `Tab` sends the text to Ask E.V. |
| `⌘J` | Ask E.V. |
| `C` | Create what this screen holds (Today: plan item · Library: set · Notes: note · note page: note in the same collection · set page: Edit mode plus a new row · collection: New menu · elsewhere: palette filtered to "New") |
| `↑↓` / `J K`, `↵` | Move through rows and tiles; open |
| `.` or right-click on a row, tile or pin | Item menu: Open · Edit set (sets) · Make cards with E.V. (notes) · New note here (collections) · Pin / Unpin · Move to collection… · Delete |
| `P` · `M` · `⌫` on a focused row | Pin · Move · Delete (to Recently deleted, with Undo) |
| `X` on a focused plan row | Done / not done |
| `S` with Detail open | That panel's primary action (Start, Drill) |
| `Esc` | Close the palette, menu or Detail; leave a field; leave Edit mode; leave study |
| Toast | One line; Undo where something changed |

### Today
| Control | Effect |
|---|---|
| Start next, `S` | Start the first open plan item: study its set, or open its note in a session |
| Plan row | Detail (properties). The ring, or `X`, toggles done. Hover: Start |
| Plan › Add, `C` | Inline new plan item; `↵` adds, `Esc` cancels |
| Proposal: Accept `A` · Edit `E` · ✕ | Add to the plan · edit the text · not now (Undo) |
| E.V.'s line › source | Detail: the source set |
| Coming up row | Detail (date properties with its kind, the weak spots for that date; on an exam, Review the prep plan / Plan with E.V.) |
| Coming up › Add date | New date row; Detail opens with the title ready to type |

### Detail panel (one panel; contents by type)
| Type | Controls |
|---|---|
| Plan item | Title in place · Status (toggle) · Date, Time, Estimate, Repeat (edit in place, `↵` saves) · Linked (picker: sets and notes) · Collection (picker) · Start / Mark not done · Move to tomorrow · ⋯ |
| Date | Title in place · Date · Kind (picker: Exam, Other) · Collection · weak spots for this date · on an exam only: Review the prep plan or Plan with E.V. · ⋯ |
| Weak spot | Lately, Missed on, Next review · Drill from (opens set) · Matters for (opens date) · Drill `S` · Mark as learned · menu: Drill / Mark as learned |
| Saved view | Shows (plan items / sets with cards due / dates / notes edited) · Within 7/14/30 days · Sort by date / newest. Applies live |
| Job | Steps with status dots · Started by, Output, Cost · by state: Stop (running) · Retry, shorter / Dismiss (failed) · Open the set (drafts waiting) |
| Prep plan proposal | Rate confidence (Low / Some / Sure) first · Approve `⌘↵` (disabled until all rated) · Ask for changes (to Ask E.V.) · Put away |
| Practice set with unsourced items | Keep marked unverified / Drop, per item · Save the set `⌘↵` (disabled until all decided) |
| Weekly review | Confirm / Not now, per proposed weak spot · Done `⌘↵` (disabled until all decided) |
| Source (note or set) | Excerpt · Open note / Open set |

### Ask E.V.
| Control | Effect |
|---|---|
| Composer `↵` / `⇧↵` | Send / new line. E.V. asks for your attempt first |
| Just tell me `⌥↵` | Answer without an attempt; logged |
| Source | Detail: source |
| Job row in chat | Activity with that job in Detail |

### Library
| Control | Effect |
|---|---|
| Accuracy line | Progress |
| Tabs: Practice · Weak spots · Dates · Sets | Show that list. A count is the size of the tab's list |
| Write with E.V. | New set in Edit mode with the drafting form open |
| New set, `C` | New blank set in Edit mode, title ready to type |
| Recent tiles · All sets tiles | Set page. The running job's tile shows Activity |
| Weak spots row | Detail (weak spot). Hover: Drill |
| Filter: All · Cards · Questions · Steps | Filter the tiles |

### Set page (view)
| Control | Effect |
|---|---|
| ← Library | Back |
| Edit, `E` | Edit mode |
| Study `↵` | Study mode (hidden when the set is empty) |
| ⋯ | Item menu |
| Modes: Cards / In order · Learn · Test | Cards starts study. Learn and Test say "later" |
| Hero card: `Space` flip, `← →` move | Browse your own set |
| Item rows | Show that item on the hero card |
| Empty set | Edit · Write with E.V. |

### Set page (Edit mode)
| Control | Effect |
|---|---|
| Title | Edit in place; `↵` jumps to the first cell |
| Cards · Questions · Steps | Change type; items convert |
| In [collection] · Source [note] | Pickers |
| Cells | Type; `↵` next cell (adds a row at the end); `⇧↵` new line; `⌫` on an empty row deletes it |
| Row ✕ | Delete row (Undo if it had text) |
| + Add card / question / step | New row |
| Write with E.V. | Form: how many (3 · 5 · 8), from which note (picker) → Write / Cancel → job row → dashed drafts |
| Drafts: ✓ keep · ✕ drop · Keep all · Drop all | Kept drafts join the set; the job finishes with "you kept N of M" |
| Done `⌘↵` / `Esc` | Save and leave Edit mode. Empty rows are dropped. A brand-new blank set you leave empty disappears |

### Study (full focus)
| Control | Effect |
|---|---|
| Answer field, Turn over `↵` | Disabled until you've typed an attempt |
| Just tell me `⌥↵` | Reveal without an attempt; logged |
| After reveal | Your attempt, the answer, its source, one E.V. line, Again `1` · Good `2` |
| End card | Back to the set `↵` |
| ← set, `Esc` | Leave |

### Notes home
| Control | Effect |
|---|---|
| New note, `C` | New note (no collection) on its own page, title selected |
| New collection | New collection page, title ready to type |
| Recent rows | Note page |
| Collection rows | Fold open / closed (click, `↵`, `→`, `←`). Hover: New note. Right-click: open collection page, new note here, pin, delete |
| Note rows (indented) | Note page. `←` jumps to the folder |

### Note page
| Control | Effect |
|---|---|
| ← Notes | Back |
| Collection picker | Move the note |
| Make cards | New set from this note, E.V. drafting |
| Start session | Session bar (timer, read-along, Pause `Space`, End), plus a check block: answer, Check `↵`, Just tell me |
| ⋯ | Item menu |
| Doc | Type. The first line is the title. Checklists toggle |

### Collection page · Saved view · Recently deleted · Activity · Progress
| Screen | Controls |
|---|---|
| Collection | Title in place · New `C` (Note, Set, Date, Collection inside) · ⋯ · Coming up dates · Everything (nested collection first, then mixed items) |
| Saved view | Title in place · Edit view (Detail) · ⋯ · matching rows |
| Recently deleted | Rows show days left · hover Restore, `↵` or `R` restores · menu: Restore |
| Activity | Needs you / Running / Done today · row opens Detail (draft jobs open their set) · hover Retry on failed |
| Progress | Read-only accuracy chart |

---

## Part B · Trace check

Status: **OK** = matches a source · **NEW** = added in rounds 5–7 at Matt's request · **RESOLVED** = a conflict Matt decided · **LATER** = shown in the mock-up, ships after cutover.

| Feature | Source | Status |
|---|---|---|
| Six sections, sidebar, centred column, Detail on demand, ⌘K | PLAN §7 layout · brief §3 | OK |
| Pins instead of "Courses" in the sidebar | PLAN C12 · brief §3 | OK (replaces the §7 wording "then Courses") |
| One glyph per type, no colour-coding, rows show at most 4 things | brief §3 | OK |
| Plan ring as status | brief §3 ("a row with a status ring") | OK |
| One E.V. line per screen, dashed proposals in the list they change | PLAN §7 rules 3, 6 | OK |
| Attempt before answer in study and Ask; Just tell me logged | PLAN §1, §7 rule 10 | OK |
| Set page hero and item list show answers | brief §5.2 (set page structure) | OK: browsing your own set. Study enforces the attempt |
| Every fact cites a source; "unverified" otherwise | PLAN §1 | OK |
| Today: plan, approved plan tasks, review set, note task, proposal, upcoming dates | PLAN §8.1 | OK |
| Weekly review as a "Needs you" job on Sundays, not a line on Today | PLAN §8.1 · brief §3 | RESOLVED (Matt: job in Activity) |
| Library: practice with cited feedback, sets, accuracy line | PLAN §8.2 | OK (accuracy line added in round 7) |
| Library: weak spots, worst first, Drill · weak spots on a date's Detail | PLAN §8.2 | OK (added in round 7) |
| Dates, where an exam offers its prep plan | PLAN §8.2, §6.4 | OK (a date of kind Exam plus the prep-plan proposal) |
| Prep plan: rate confidence first, then Approve | PLAN §8 "Matt-first planning", C9 | LATER. At cutover, Approve works without ratings; the ratings arrive with Matt-first planning |
| Ask E.V. with job status | PLAN §8.3 | OK |
| Notes: editor, image, two-column rows, read-along, checks, writing time (session timer), outbox ("saved on this device") | PLAN §8.4 | OK. Session comments appear as E.V.'s reply under a check |
| Notes home with folding collections; one centred page per note | Matt, round 6 · replaces brief §5.3 | NEW / RESOLVED |
| Activity: needs you, running, done, failed with its reason | PLAN §6.2, §8.5 | OK |
| Delete → Recently deleted for 30 days, Undo, no "delete forever" | PLAN §2.1.3, §2.2, §5.6 | OK |
| Jobs are never deleted | PLAN §5.3 | OK |
| Create, edit and delete by hand for every item Matt owns | Matt, round 5 (a rule) | NEW |
| One "with E.V." action beside manual create; her output arrives as dashed drafts, kept or dropped | Matt, round 5 · PLAN §1, §6.1 (propose mode) | NEW |
| Set editor (Edit mode on the set page) | Matt, round 5 | NEW |
| Write with E.V. / Make cards (drafts from a note) | Matt, round 5 | NEW (see C2) |
| Collections of any kind, nested one level, one per item | §data.membership · brief §3 | SETTLED: v5's own tables (see C1) |
| Saved views | brief §3 | NEW data (see C1) · LATER (proposed) |
| Plan-item properties: time, estimate, repeat, linked item | brief §3 | NEW data (see C1) |
| Dates of any kind (an exam, a half marathon, a trip), each with a kind | §what.framing ("an exam is a dated goal") | SETTLED: v5's own tables (see C1); the kind picks what a date offers |
| Weak spots: E.V. proposes, Matt confirms; Mark as learned is a status | PLAN §5.7 (derived, rebuildable) | OK. Weak spots have no glyph: they aren't one of the eight types |
| Card sets and step sets, with due counts and Again / Good | brief §3 · PLAN §5.7, C3 | LATER (RESOLVED: shown as the long-term design) |
| Learn / Test modes | brief §3 | LATER |
| Phone layout | brief §5.10 · PLAN §2.2 ("phone stays frozen") | LATER (reference only) |
| Set's collection and source on its Edit page, not in Detail | brief §3 ("properties in Detail") | RESOLVED (Matt: keep on the set page) |
| Key hints beside actions | brief §2 (kept from A) · PLAN §7 rule 8 ("hints in tooltips and ⌘K") | Brief wins on looks (PLAN §7). Rule 8 wording to update |

### PLAN §7 UI rules against the mock-up
| Rule | Result |
|---|---|
| 1 Two surfaces, no boxes in boxes | Holds. Frames only on tiles, the study and hero card, the check block and dashed drafts |
| 2 Three text sizes, 600 for titles only | Holds, plus the brief's single card-face size (24) |
| 3 One orange element per screen | Holds. When Detail has a primary action, the screen's own primary steps down |
| 4 Status only as a dot or a meter | Holds. The plan ring and the job ring are glyphs that also carry status |
| 5 Lists without frames; actions on hover, focus or right-click | Holds |
| 6 E.V. speaks once per screen; suggestions dashed | Holds |
| 7 8 px grid, 40 px rows, 48 px between sections | Holds |
| 8 Keys instead of extra buttons; hints in tooltips and ⌘K | Changed: hints also sit beside actions (brief) |
| 9 One question at a time | Holds |
| 10 Answer after attempt, in practice and Ask | Holds |

### Hard limits (PLAN §2.1) against the mock-up
| Limit | Result |
|---|---|
| No personal data | Synthetic content only |
| Canvas read-only | Not touched by the UI |
| Nothing deleted except Matt's own deletes, after 30 days | Recently deleted, 30 days, Restore; no purge button |
| Live deploys on Matt's word | Not a UI matter |
| Own database, additive schema | Settled (C1): every new thing has its own table in v5's own database (§data.own-db, §data.additive) |
| Model ids and prices from docs | Not a UI matter |

---

## Part C · For the architect

1. **Where new things are stored: settled.** v5 keeps its record in its own database, one table per kind (§data.own-db, §data.tables), so each NEW data item above has its own table, with export and restore-drill coverage before it goes live:
   - collections of any kind, and nesting;
   - pins and saved views;
   - plan-item time, repeat and linked item;
   - dates of any kind, each with its kind (title, date, kind and collection only);
   - set items typed by hand, and step sets;
   - E.V.'s drafts awaiting keep or drop;
   - "Mark as learned" on a weak spot.
2. **"Write with E.V." and "Make cards".** Is this the practice-set job writing drafts into a set (no new job kind, so it fits the cutover jobs in §6.4)? Or a new kind that waits for cards?
3. **The command registry (§6.1).** Every action in Part A becomes a registry command: about 40, plus "New …" for each type. Drafts and proposals are E.V. commands in propose mode.
4. **Kit (§7, first set).** The mock-up's 15 components differ from the plan's first set:
   - adds Tile, Glyph, Source and Text options;
   - folds Shortcut hint into Button and Job card into Row;
   - drops Sheet and Meter (nothing uses them now).
5. **Weak-spot visibility.** Weak spots have no glyph (they aren't one of the eight types). Confirm that a row without a glyph is acceptable, or add a ninth glyph.

---

## Part D · Change list

Final. It's also in `design/CHANGELIST.md`, which is the copy to use.

```
skeleton:  areas/* unchanged (six areas). Sidebar region: "Courses" → Matt's pins (C12), plus a
           Recently deleted link at the foot. Notes area: a home list and a note page
           (no list and doc side by side).
rules:     + Every item Matt owns: create, edit, delete by hand where it lives; delete → Recently
             deleted (30 days, Undo).
           + Where E.V. can help: one quiet "with E.V." action beside the manual one; her output
             arrives dashed and cited; Matt keeps or drops each piece.
           + C creates the thing the screen holds; E edits a set; ⌫ deletes; . or right-click opens
             the item menu; P pins; M moves.
           + Properties edit in place in Detail. Exception: a set's collection and source sit on its
             Edit page.
           ~ Rule 8: key hints sit quietly beside actions as well as in tooltips and ⌘K.
           + Weak spots: E.V. proposes from misses, Matt confirms; Mark as learned is a status.
scope:     cutover (PLAN §8) unchanged, shown as: weekly review = a Needs-you job (not a Today line);
           weak spots on the Library home and on a date's Detail; accuracy line under the Library title.
           After cutover: card and step sets (due, Again / Good), Learn / Test, saved views
           (proposed), rating confidence before approving a plan (C9), phone layout. Needs Matt's yes: given by "approved".
kit:       Button (+ key hint) · Field (input, segmented choice, cell) · Row (+ folding, editor row) ·
           Tile · Glyph (8) · E.V. line · Suggestion (proposal, draft) · Source · Study card (+ hero) ·
           Text options · Detail (+ properties) · Menu (+ pickers) · ⌘K palette · Toast · Doc (+ session bar)
```
