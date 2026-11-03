# K · Campus: courses are the spine

**Where it sits:** about 60% productivity, 40% consumer. The styling stays close to A (Inter, A's spacing, flat, dark by default); what changes is the structure. Each course is a place, like a Slack channel, and Today stays the home across courses. Plans are Linear rows, sets are Quizlet-like tiles, notes are Quip-like doc lists. Warmth comes from warm neutrals, 8–12 px radii and one muted colour per course, not decoration.

**The language:** shape says what a thing is, colour says which course, orange means E.V. or the screen's one action. Each type has a list, a tile and a link form (all in `#system`); the link form is also the source chip.
- **Course:** a tinted badge with its code; a swatch everywhere else.
- **Flashcard set:** a tile with a stacked edge (two cards peeking below) and a mastery meter.
- **Practice set:** one pip per problem from the last try (right, missed, not tried), plus accuracy.
- **Mock exam:** stopwatch glyph, minutes and questions, a perforated foot with best score or "E.V. is writing it".
- **Procedure set:** numbered steps on a rail; the first two, then "+7 · 7 of 9 in order".
- **Note:** a page with a folded corner, title, two-line preview, in a folder.
- **Plan item:** a Linear row: status circle, priority bars, title, then chips (linked material, course, estimate, time).
- **Job:** E.V.'s ring cut into one arc per step, coloured by state, with its steps, where it lands and its cost.
- **Exam:** a calendar date block and a readiness meter.
- **Weak spot:** a target glyph and the recent tries that were right ("4 of 9").
- **E.V.'s voice:** her dotted mark, one line, a source chip or "unverified".

**Design system:**
- **Tokens:** warm neutrals in two themes, every text pair 4.5:1 or better. Six muted course colours `--c1…--c6`, never on text; only as a swatch, a glyph colour or an 11–24% tint.
- **Type and shape:** Inter only at 12, 14, 16 (reading), 20 and 24 (set and doc titles). An 8 px rhythm, 48 px between sections. Radii 4 keys, 6 chips, 8 buttons, 10 glyph tiles, 12 tiles and sheets.
- **Elevation and motion:** surfaces flat, tiles a 1 px line; only sheet, palette and toast pop. 150 ms fades, 200–250 ms 4 px rises, no bounce.

**Library:**
- **Desktop:** the all-courses Library has a course switch, "Jump back in", type filters and tile sections by type. A course's Library tab is one mixed grid by last studied, filtered by type. A set page has the creator, four modes (Flashcards, Learn, Test, Explain), a flippable hero card and the term list with mastery dots.
- **Phone:** the same tile objects in two columns, cut to one key fact; course and type filters become scrolling chips, "Jump back in" a carousel. Study is full screen with a full-width Flip.

**A day in it:**
- **Morning:** Today mixes NUR 112 and BIO 201; swatch and glyph keep them apart. S opens Oral liquid doses (commit, then cited feedback).
- **Between classes:** Activity shows 2. Exam 3's plan asks his confidence before it shows the dashed sessions; he approves.
- **Afternoon and night:** NUR 112 › Notes › Lecture notes › Wk 9, a read-along session and a check in his own words, saved on this device. Then sterile gloving, step by step.
- **New term:** PSY 210 in one short sheet: code, name, colour, optional Canvas link, first exam.

**Risks:**
- **Two homes:** Today and a course Overview could compete. Overview shows only that course's next three items, as links; nothing is copied.
- **Colour noise:** past six courses the swatches stop helping; the sidebar also grows per course. Needs an "archive the term" step.
- **Height and length:** the course header (about 120 px) costs editor height and should collapse on scroll. Tiles make the Library long; the filters carry it. Procedure step names get cut short on tiles.

**Plan impact:**
- **Areas:** add `areas/courses/`, one area rendering a space per course record at `#course/:id/{overview,plan,library,notes,exams}`. Its tabs are course-scoped views reusing parts from `areas/today` (plan rows), `areas/library` and `areas/notes`, filtered by `courseId`. `library` and `notes` stay as "All courses" views; `progress` folds into each Overview plus the weekly review.
- **Sidebar:** Today, Ask E.V., Activity, then Courses (data-driven, + Add course), then All courses (Library, Notes).
- **Domain:** a course gains `code`, `colour` (a token name), `canvasUrl` and `meets`. A note gains one folder level per course. A plan item gains the Linear properties: status, priority, course, type, material, weak spot, estimate, scheduled, due, repeat, source, subtasks.
- **Kit:** SetTile (four bodies), DocRow, PlanRow, JobRing, DateBlock, WeakFraction, ObjectLink, CourseBadge, the course Tabs and the Add-course Sheet.
- **UI rules:** rule 1 allows set and note tiles in the Library and on course pages. Rule 2 becomes five text sizes. Rule 4 adds pips and the job ring. Rule 7 makes plan rows 44 px. New rule: one colour per course, only as a swatch, glyph colour or tint.
