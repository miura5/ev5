# L · Study hall (about 30% productivity, 70% consumer)

**Where it sits:** the most "learning app" of the four. It borrows Quizlet's structure (the set as the unit, study modes, the card front and centre, the term list) and Duolingo's flow (where you are, one big action, plain encouraging words, one thing at a time). There are no mascots, streaks, XP or confetti. The productivity side (Today, plan items, Notes, Activity) stays Linear/Quip-quiet, so the semester still runs from the desktop. **Why:** Matt studies in short bursts on the go, and his complaint was that "everything looks like a task". Here the study material looks like study material, and only the plan looks like a plan.

**Object language** (`#system` shows each type as a list row, a tile and a link):
- **Flashcard set:** teal; the tile shows a card on a stack with a real term; the link has a cards glyph.
- **Practice set:** violet; the tile is a grid of problem cells showing the last attempt (filled = right, dashed = miss).
- **Mock exam:** berry; the tile is a paper with a timer badge, and a dashed "E.V. is writing" pill while its job runs.
- **Procedure set:** olive; the tile is a numbered stepper. In study mode the steps run down a numbered rail.
- **Note:** paper, never tinted; a folded-corner page glyph, a neutral title and a snippet.
- **Plan item:** a Linear row (time, status circle, title, then property pills: linked set in its type colour, course, estimate). The next block is lifted into a card. Proposals are dashed.
- **Job:** E.V.'s dotted ring around a progress arc, coloured by state (ember running, amber needs you, green done, red failed), plus step dots, cost and "lands in". Its link form is a dashed pill.
- **Course:** a coloured lettered square (sidebar, Slack-style), a badge card and a square-plus-code tag.
- **Exam:** a calendar leaf in the course colour. **Weak spot:** a target glyph plus right-of-last-n cells.
- **E.V.'s voice:** the dotted mark, one line and source chips (or "unverified", dashed).

**System in brief:** Figtree with Inter as fallback, one family. Four sizes: 13 meta, 15 body, 20 title, 28 display (the card in study mode). Weights 400/500/600. Warm paper neutrals in light, warm charcoal in dark. One ember accent for the primary action and E.V.'s mark. Two muted families: set types (tint + icon) and courses (square). The spacing is A's: an 8 px rhythm, 48 px between sections, a 720 px column. Radii are 6 chips, 8 controls, 12 cards, 16 tiles. Everything is flat; the only shadow is the active study card. Motion is 120–200 ms fades. `\` toggles the theme and ⌘K opens search.
**Library, desktop:** Continue studying (one card with the set, mode, progress and Resume), then Due today (three cards across sets), then Your sets (filter pills by type and a tile row per type), then By course. The set page has its title and source, a mastery bar, four modes (Flashcards · Learn · Test · Match), a hero card you can flip and arrow through, and the term list with per-term mastery. Study modes are full-focus: the sidebar steps back, leaving a close ✕, the set name, a slim progress bar in the type colour, the active card with the one shadow, large type and one big action.
**Library, phone:** the same components in the same order. The Continue card's Resume is full width, Due today scrolls sideways, tiles sit two across, and the tab bar has four tabs (Library, Today, Ask E.V., Activity). Study keeps the card above and the action at thumb height.

**A day in it:** 6 am, Today shows "Next · 9:30, Oral liquid doses" and he presses S. On the bus he opens the phone's Library, sees "Continue: Cardiac output terms 14 of 24" and taps Resume. Each card asks for his try, flips to the cited answer with his words beside it, and he rates Again or Got it. Between classes, Activity's amber "1" turns out to be the Exam 3 plan. He rates five topics (Shaky to Solid), sees E.V. push back once on fluid balance, and approves. At 2 pm he recalls sterile gloving step by step and the compare view flags the waist-height detail. In the evening he takes a notes session with read-along, and the mock exam lands in the Library when its ring closes.
**Risks:**
- Two colour families (types and courses) plus feedback colours is the most colour of the four. It holds only while tints stay muted and courses stay squares.
- Tiles cost more room than rows. With 40+ sets the type groups need "See all" or a dense list toggle.
- The 28 px study type and 48 px buttons depart from the 20/14/12 scale rule.
- The ember marks E.V. and the primary action, so a screen can show two ember things (rule 3 is loosened).

**Plan impact:**
- **Areas (skeleton):**
  - Courses become an area (`areas/course`), listed in the sidebar with "Add course".
  - Progress folds into the Library (mastery and the Continue card) and the course pages: remove `areas/progress` from the sidebar.
  - The Library splits into home, set page and the study modes (practice, flashcards, mock exam, procedure).
- **Layout:**
  - Study modes use a sixth region, full-focus (no sidebar, a top bar with a progress bar).
  - The Detail panel becomes a right sheet over a scrim, and the plan item gets Linear properties plus "Add a property".
  - Notes get their own folder pane (264 px).
  - The phone gets a four-tab bar that opens on the Library.
- **UI rules that change:**
  - Rule 1: tiles and cards are allowed for sets, jobs, exams and the next block.
  - Rule 2: the type scale becomes 13/15/20/28.
  - Rule 3: the ember is for primary actions and E.V.'s mark.
  - Rule 4: tiles may show progress art (cells, stacks, steppers).
  - Rule 5: lists keep no frames, but objects get their own form.
  - New rule: each object type keeps one form everywhere (row, tile, link).
- **Kit:** tile and its art variants, continue, due card, set header, mode card, hero card, focus top bar, flash card, question card, unit field, feedback, procedure step, compare, job card and ring, calendar leaf, course badge and tag, source chip, property pill, status circle, confidence pick, sheet and palette results.
