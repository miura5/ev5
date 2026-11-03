# J · Studio: the Airbnb-modern midpoint

**Where it sits:** 50/50. Linear and Slack shape the frame: a slim sidebar with C's Courses, A's 720 px column and 48 px section rhythm, a detail sheet, and rows wherever he scans. Airbnb and Quizlet shape the things he browses: covers, tiles with a soft hover shadow, a set page with a hero card. One family (Inter), warm neutrals, and one terracotta accent for the primary action and E.V.'s mark. Productivity owns the structure and consumer owns the objects, so it reads as one product.

**Object language** (each type has a list, tile and link form; see `#system`)
- **Course:** a flat generated pattern cover (dots, waves, arcs) in its colour; a patterned swatch in the sidebar; a swatch chip as a link.
- **Flashcard set:** a deck, with two card edges peeking below the tile. Blue card glyph, card count, mastered/learning bar.
- **Practice set:** its last attempt as a row of pips. Teal check glyph.
- **Mock exam:** a ticket, with question count and minutes in large numbers over a dashed perforation with notches. Plum stopwatch glyph.
- **Procedure set:** a numbered ladder showing the first steps. Amber steps glyph.
- **Note:** paper. A neutral page glyph, title, one-line excerpt and folder. No chips, colour or meters.
- **Plan item:** a Linear row, and the only object with a status ring. Properties sit under the title as chips: material, course, estimate, recurrence, priority. Time is on the right. It opens in a sheet.
- **Proposal:** anything E.V. proposes is dashed, both the ring and the border.
- **Job:** a sunk card with E.V.'s dotted mark (it turns slowly while running), a state pill, a step trail, cost, and where the output lands.
- **Exam:** a date block with the course colour on its top edge. **Weak spot:** an amber target and a fraction of pips ("4 of 9").
- **E.V.'s voice:** her mark, one line and source chips. Never a bubble or a tile.

**System in brief:** Inter at 12 / 13 / 15 body / 17 / 20 / 28, plus 32 for the card face. Spacing on an 8 px grid; 48 px between sections. Radii are 8 (chips), 12 (controls), 16 (tiles, cards, jobs) and 20 (flashcard). Elevation is flat at rest, one soft shadow on hover for browsable cards only, and a pop shadow for overlays. Motion is 120 / 180 / 320 ms with no bounce, and is off under reduced motion. Muted families: 4 type hues used only on glyphs and type labels, and 3 course hues used only on covers and swatches. Status is green, amber or red, used only in meters. Light is the default; dark is warm charcoal. `\` toggles the theme.

**Library:**
- **Desktop:** "Jump back in" (3 resume cards with progress), then "Your sets" with a course segment and type pill tabs (All · Flashcards · Practice · Mock exams · Procedures), then a 3-up tile grid. A running job's tile sits in the grid where its output will land. Create set is the one primary action.
- **Set page:** type label, course chip, "made by E.V. from [note]", 4 study modes (Flashcards · Learn · Test · Explain), a hero deck you can flip (Space) and arrow through, then the term list with 3-pip mastery.
- **Phone:** the same tiles stack one per row with the same forms. Jump back in scrolls sideways, the type pills scroll, and courses collapse to a menu. There is a bottom tab bar. In study, the card back carries its source, his try sits under it, and Again / Good sit in the thumb zone.

**A day in it:**
- **6 am:** he reads Today: one E.V. line, five plan rows with their chips, and one dashed suggestion. He presses S.
- **10:30:** oral liquid doses in the exam runner. He commits, gets cited feedback, and the miss lands in a weak spot.
- **Lunch, on the phone:** Library, then Jump back in, then cardiac cards. He types his try, flips, and rates Good.
- **Evening:** Activity shows the Exam 3 plan as Needs you; he rates his confidence and approves, then reads the Ch 9 note with read-along and answers E.V.'s check in his own words.

**Risks:**
- Seven muted hues is the upper limit, and adding a fourth course needs a palette rule (pattern varies first, hue second).
- Covers could drift toward decoration if anyone adds photos or gradients; the rule is flat two-tone patterns only.
- The tile grid is wider (920 px) than A's 720 column.
- The notes pane stacks folders over docs to give the editor room, so deep folder trees would need collapsing.

**Plan impact:**
- **Areas:** add `areas/courses`, one page per course record (cover, exams, weak spots, materials by type, notes). `areas/library` grows a set page and three runners (flashcards, exam/practice, procedure), shown full-screen without the sidebar.
- **Layout regions:** the sidebar gains a Courses group with "+ Add course". There is a right detail sheet (408 px) for plan items. Focus mode hides the sidebar for the runners. The Library column is 920 px; everything else stays at 720.
- **Domain:** a plan item gains `type`, `linked material`, `recurrence`, `priority` and `subtasks`; a course gains `colour` and `pattern`; sets gain `kind` (flash, practice, mock, procedure).
- **UI rules that change:** "dots are status only" becomes "type and course families are allowed, on glyphs, swatches and covers only"; only browsable cards lift on hover; only plan items carry a status ring; anything proposed is dashed; the three-size type scale becomes seven steps.
- **Kit additions:** glyph, swatch/cover, tile (with flash, prac, mock, proc, note, course and job faces), resume card, plan row with property chips, date block, job card, deck/flashcard, and a phone frame for previews.
