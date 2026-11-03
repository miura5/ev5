# Variant D · The runway

**Idea:** the days from today to the next exam are the spine of the app, and E.V. shows Matt his own confidence beside his tries so he can see where his judgement is off.

**What it optimizes and why it should help him learn**
- Visible spacing: future days are one line of topic names, so he sees preload or oral doses come back Tue, Wed, Thu, and rows say "again Wednesday".
- Calibration: each objective shows his rating (Low / Some / Sure) beside a tries meter, with a grey "overconfident" or "underrated" where they disagree. He rates before he sees scores, and each question has an optional "How sure?".
- Ownership: E.V. proposes dashed blocks inside the day they would change. He accepts them, moves blocks (drag, "Move to…" or M) and approves the plan. The one ember action is Start on today.

**A day in it**
- 6:40 am: Runway opens on Today with 4 blocks. He presses S, and every answer in the review moves an objective's tries.
- Between classes, he opens Tuesday's "+1 proposed", accepts the preload block, and moves the notes block to Wednesday.
- Evening: Activity says the Lab practical 2 plan is waiting on his ratings. He rates 7 objectives blind, the job drafts dashed blocks, and he removes one and approves. Thursday: "Misses only", then the exam.

**Where cutover scope lives**
- Day plan (plan blocks, morning set, note tasks): Runway › Today. Upcoming exams: Runway head, exam marker, dim next-exam line, "All exams". Weekly review: Runway › This week.
- Practice (one question, commit, cited feedback): Library › Practice. Weak spots: Library › Weak spots, also shown as Objectives rows.
- Exam plan, confidence first: the Plan view (Rate › Drafting job › Proposal › Approve, Ask for changes, Put away).
- Ask E.V. (attempt first, "is it ready?" from job status). Notes session (bar and timer, read-along, checks in his words, saved on this device). Activity (needs you, running, done), sidebar job line, ⌘K with Tab to ask.

**Trade-offs and risks**
- Everything leans on an exam date. With no exam, the runway needs a 7-day fallback, which is not drawn.
- Calibration can sting. Flags are single grey words, never colour, and E.V. names only the biggest gap.
- Rating fatigue: ratings persist, and he is asked again only when a plan is drafted.
- Drag and drop is hard without a pointer. "Move to…", M and the arrow keys in the menu cover it.
- The plan proposal moves out of Detail into the column. It gets more room, but it is one more view to build.

**Plan impact (if chosen)**
- skeleton: rename `areas/today` → `areas/runway` (Days and Objectives tabs, plus `parts/Plan`). Remove `areas/progress`: the accuracy line and weekly review go into Runway › This week, per-objective accuracy into Objectives. Exams move from `areas/library` to `areas/runway`. Library keeps practice, weak spots and sets. ask, notes and activity are unchanged.
- scope (Matt's call): bring **predictions and calibration** and **Matt-first planning** in from after cutover (PLAN §8). Adds `objective.confidence` (additive, with a rated-at date), tries counted from first attempts, and the commands `objective.rate` and `plan.moveBlock`.
- layout: the same five regions. The plan proposal goes in the area column with a sticky decision dock, not in Detail.
- UI rules: rule 3 holds because a primary that isn't ready steps down to a hairline outline, and E.V.'s mark holds the ember until it is ready. Rule 4 gains a grey one-word flag, never a badge or a colour.

**Kit classes added** (variant D section, tokens only, 12/14/20 only): the Runway pattern `.runway .day .day-head .day-name .day-sum .day-body .pin .tm`; `.grip`; `.prop`; the menu `.menu .mi .menu-sep`; the calibration row `.cal-r .n-of .flag`; the per-try meter `.tries`; `.stepper`; `.dock`; `.doc .reading`; `.btn.primary:disabled`; `.lrow > .dot`; `.fade`.

**Token changes:** none. Dark is the default, plus `screens/runway-light.png`.
