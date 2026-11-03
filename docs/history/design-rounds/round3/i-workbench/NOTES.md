# I · Workbench — A, with real depth and distinct objects

**Where it sits: about 70% productivity, 30% consumer.** It is the closest direction to A: dark graphite, Inter, the 8 px rhythm, 48 px between sections, a column of at most 720 px, and the sidebar + column + Detail layout. It adds C's Courses group to the sidebar. Depth comes from objects rather than decoration. Today and the plan item work like Linear. The Library and the study modes borrow Quizlet's structures (set tiles, mode buttons, a hero card, term lists), in A's calm and still with one ember per screen.

**Object language: one device per type, the same in a list, a tile, a link and ⌘K**
- **Course:** a filled 10 px swatch in its own muted colour (sidebar, chips). The course page uses a tinted "#" tile.
- **Flashcard set:** a blue tile with a two-card glyph. Its tile has a stacked-card edge and shows the first term. Its card faces have the same edge.
- **Practice set:** a green tile with a pencil glyph. Its tile shows a row of pips: right or wrong on the last try.
- **Mock exam:** a violet tile with a stopwatch glyph. Its tile shows three stats: questions, minutes, last score.
- **Procedure set:** an ochre tile with a stairs glyph. Its tile shows a short numbered preview of the steps.
- **Note:** a neutral tile with a page glyph. In lists it is a Quip-style doc row with a two-line preview. Notes never get a card.
- **Plan item:** a Linear status ring (to do, started, done, dashed for proposed) plus the tile of the thing it trains. Property chips sit on the right: linked material, course, estimate, time.
- **Agentic job:** E.V.'s dotted ring, coloured by state, with a 2 px progress line and "step n of m". A job is never a ring with a check, so it can't be mistaken for a task.
- **Exam:** a calendar-leaf tile with the day number. Its top band is the course colour.
- **Weak spot:** a coral tile with a target glyph, always with pips showing "n of m right lately".
- **E.V.'s voice:** her dotted mark, one line, and a source chip (tile + name) or "unverified".

**Design system in brief**
- **Tokens:** two full themes, all CSS custom properties. Nine muted family colours and three course swatches (plus three free ones), mixed in at `--tint` (16% dark, 13% light) for tile grounds and never used for text. Contrast: text 15.5:1, quiet 7.3:1, faint 5.9:1 (dark); 16.4 / 6.1 / 5.5 (light).
- **Type, shape, depth:** Inter only, 12 / 14 / 20 at 400 / 500 / 600 (titles); card faces alone use 24 / 500. Radii 4 / 6 / 8 / 12 / 16, tiles 16 / 22 / 32, rows 40 / 48. Surfaces are flat (hairlines, tints); only ⌘K, menus and the toast have a shadow. Motion: fades and 4 px rises (150–250 ms); the running job ring turns once every 6 s; reduced motion turns it all off.

**The Library**
- **Desktop (880 px column, three tiles across):** "Jump back in" resume tiles with a progress line in the type's colour; filter pills (All · Flashcards · Practice · Mock exams · Procedures, each with its tile) and a course menu above the grid of set tiles; a set E.V. is still writing sits in the grid as a job tile; weak spots follow as rows.
- **Set page:** four mode buttons (Flashcards · Learn · Test · Match), a flippable hero card (Space, ← →) and the term list with mastery dots.
- **Study modes** take over the area under a study bar (×, set name, count, progress line). Flashcards: attempt → flip → cited back → Again / Good. Mock exam: a 40-square navigator, Commit, then a cited review after Submit. Procedure: type the next step in order → Check → the step with its sources.
- **Phone (390 × 844):** the same tiles in two columns, pills and jump-back tiles that scroll sideways, and a bottom bar (Today · Library · Notes · Ask E.V.). Flashcard study keeps the card, its stacked edge, the attempt, the cited back and two large Again / Good buttons. Swiping also rates the card.

**A day in it**
- **6 am, Today:** the plan is grouped Morning / Afternoon / Evening. The ring, tile and chips show what each item is, for which course, with what, how long and when. He presses S; the started procedure opens and he types step 5.
- **Between classes:** he opens "Oral liquid doses" and it reads like an issue. He moves it to 4:00 pm, sets it to repeat every other day, and ticks a subtask.
- **11:40, Ask E.V.:** he asks whether the mock is ready. She answers from the job card: step 3 of 4, and it will land in Library › NUR 112.
- **Evening:** from NUR 112 he rates his confidence and Approve wakes up. He approves six sessions, then runs a notes session: read-along, E.V.'s check answered in his own words, saved on this device.

**Risks**
- **Many family colours** could drift toward a rainbow: colour appears only at 16% tint or in a 10 px swatch, never in text, and course vs type is told by shape (filled square vs tinted tile with a glyph). **Framed tiles** bend rule 1; if the bend spreads, the "sea of rows" returns as a sea of cards.
- **Property chips at 640 px:** they squeeze titles. Long titles ellipsize, and the chips are fixed, so titles must stay short.
- **Not drawn:** Learn, Test and Match beyond their buttons; drag-to-arrange for procedures; non-mock practice feedback (same card as A); full BIO 201 and NUR 114 course pages (the header only).

**Plan impact (if chosen)**
- **Skeleton:** add `areas/courses`, one course page rendered from course records, with Courses in the sidebar from data rather than from `area.ts`. Library gains sub-routes: set page, flashcards, mock or practice runner, procedure runner.
- **Domain:** the plan item gains priority, estimate, scheduled time, recurrence, subtasks and links; the set gains kinds (flashcards, practice, mock exam, procedure); the course gains a colour.
- **Scope ("scope:" items for Matt):** procedure sets, and the Learn / Test / Match modes. Mark them "after the switch" unless he pulls them in.
- **Layout:** Library uses an 880 px column (the one exception to 720). Study modes take over the area. Notes have three panes: folder tree (two levels at most), doc list, doc. The plan item opens full-column, with its properties in Detail.
- **UI rules:** rule 1, objects you open or study (set tiles, card faces, mode buttons, job cards) may have one frame or fill, and lists stay frameless; rule 2, add the 24 px card-face size; rule 3, add A's "panel leads" (when Detail holds the primary action, the screen's own steps down); rule 4, status forms are the dot, meter, pips, plan ring and job ring; rule 8 follows A (quiet key hints beside actions).
- **Kit and tokens:** TypeTile, CourseSwatch, StatusRing, JobRing + ProgressLine, PropertyChip, PlanRow, NoteRow, JobRow, ExamRow, WeakRow, SetTile (four variants plus writing), JumpTile, ModeButton, HeroCard, TermRow, PropertyPanel + PropertyMenu, FilterPill, ExamNavigator, ProcedureStep, FolderTree. New tokens: `--fill`, `--float`, `--t-*`, `--c-*`, `--tint`, `--fs-card`, `--r-xl`, `--tile*`, `--ring`, `--detail-w`.
