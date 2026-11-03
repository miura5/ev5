# G · Margins

**In one line:** E.V. as a finely set textbook page. Matt's work fills the column, and E.V. speaks in the wide right margin as numbered sidenotes, beside the thing she means.

## The system ("Margins", every value a token in `mockup.html`)
- **Palette:** warm paper `#FAF8F3`, ink `#24211D`, two greys (6.8 and 5.2 : 1) and hairline rules. The one accent is rubrication red `#A63A24`, used for the single main action, E.V.'s ¶ mark and sidenote numerals. Night reading is sepia-charcoal `#1E1B17` with parchment ink and a softer red `#D9795C` (`\` toggles it). Status never uses colour, only fill: ● ◐ ○ ◉ ×.
- **Type:** Source Serif 4 for all content, at three sizes: 23/30 title, 17/26 text, 13/19 notes. Optical sizes keep the 13 px notes sturdy. Labels are tracked small caps, used sparingly. Figures are oldstyle in text and tabular lining in tables. Source Sans 3 appears on controls only. Weight 600 marks only the exercise number and the occasional key word.
- **Shape:** hairlines, 2 px corners on controls and none on pages, round shapes only for dots. Tables follow booktabs: a heavy top and foot rule and no verticals. A dashed rule means *proposed*; a solid one means *his*. The ruled lines of the answer space are the only texture.
- **Depth and motion:** flat, with one shadow token for ⌘K and toasts. Timings are 120 ms (hover), 240 ms (turning a leaf, switching theme) and 360 ms (a note rising 6 px). Under reduced motion all of them are instant.
- **Signature components:** sidenote and E.V.'s line, the turning leaf with its page marks, the workbook exercise (ruled working, a blank for the answer, a worked solution), word-sized sparklines and small multiples, the contents rail, and the session bar standing in for the running head.

## Why it fits Matt
- **Calm:** the calm comes from the page structure, not from decoration. One column means one thing at a time. The margin keeps E.V. present but out of the way: she speaks once, where the thing is, and her sources sit beside every fact. The precision reads as trustworthy.
- **Decision load:** the single red button is always the obvious next step. Proposals are dashed until he accepts them.
- **Feels like his:** it reads like a brilliant student's annotated textbook. His own words are always set in italic, so the page visibly holds his thinking next to hers. This is the Peter Parker part: handmade, not corporate.
- **Speed:** ⌘K, `g` + letter, Enter, ←/→, Space, 1/2, A/E/C/P and T all work.

## The carousel without becoming carousel-driven
- **One card:** there is one leaf, set as a page in its own frame. It is the only frame on the screen, because it is the thing being answered.
- **Neighbours:** neighbouring leaves are *named* in small type ("← 4 Afterload · Ejection fraction 6 →") and never drawn as tiles. Position is a thin row of page marks: seen, marked again (a dot), current (taller).
- **Attempt first:** he writes an attempt on ruled lines, and Enter sets it. Space turns the leaf over to show the back, with its source in the margin and E.V.'s one comment on his attempt.
- **Marking:** 1 or 2 marks the leaf Again or Good and turns to the next.
- **Escape hatch:** "Just tell me" (T) reveals at once and is logged as *told, not tried*.

## A day in it
1. **7:40 a.m., Today:** four numbered blocks (70 min), and one dashed proposal with E.V.'s reason beside it. He presses A.
2. **Between classes:** Enter on "Begin" opens the workbook, Exercise 3. He works on the ruled lines and commits. The worked solution appears with its source in the margin, and E.V. points out that he dropped the units.
3. **After lab:** in the ch 9 study session (timer, read-along, saved on this device), E.V.'s check question waits in the margin beside the afterload bullets, and he answers it there.
4. **Evening:** in Ask he types "is the mock exam ready?". She answers from the job (question 31 of 40, a meter, a link to Activity).
5. **At home:** he rates his confidence for Lab practical 2, and approves the drafted plan.

## Risks, and five years on
- **Risk: too literary.** Mitigation: controls stay sans and the layout behaves like a modern, keyboard-first app.
- **Risk: the margin collides.** Notes are laid out by a small script, and long runs of notes need a rule (at most three per screen).
- **Risk: needs width.** The layout needs about 1100 px. Narrower screens would fold notes inline, which is fine with the phone frozen.
- **Risk: fonts.** Oldstyle figures and small caps need the full font files. Google's CSS API strips those features, so the fonts are self-hosted (OFL, from the google/fonts repo, subset to about 280 KB and embedded here).
- **In five years:** book typography has aged well for 500 years. Nothing here is a trend: no glass, gradients, blobs or big radii. What could date it is the warm paper tone, which is a single token.

## Areas, and the plan impact
- **Rail entries:** Today → `today` · Library (sets and leaves, practice, weak spots, exams with plans) → `library` · Notes (study sessions) → `notes` · Ask → `ask` · Activity → `activity`.
- **Progress:** progress → `progress` has no rail entry; it appears as the weak-spots small multiples, the accuracy line, and Today's weekly sentence. Skeleton choice: keep `areas/progress` and render it inside Library, or "skeleton: merge areas/progress into library".
- **PLAN §7 tokens change:** orange → rubric red, dark-first → light-first, Inter → Source Serif 4 + Source Sans 3, and 20/14/12 → 23/17/13. Rule 3 becomes "one red action per screen, plus E.V.'s mark and note numerals".
- **PLAN §7 layout change:** the **Detail panel becomes the margin**. Item detail opens in the column, and its facts and sources go to the margin. The 720 px column becomes 568 px plus a 236 px margin.
- **Kit (S-21…):** add Sidenote, E.V. line, Leaf, Page marks, Sparkline, Small multiple, Booktabs table, Ruled field, Blank, Rating, Session bar.
- **Notes editor (S-75/76):** session comments and check questions are anchored to block ids so they can live in the margin.
