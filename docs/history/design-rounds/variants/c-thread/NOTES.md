# Variant C · The thread

**Idea:** Today is one calm thread per day with E.V. Her morning post holds the plan, the day adds quiet event lines, practice and asking happen inline, and each course is a channel.

**What it optimizes for Matt, and why it should help him learn.** Decisions stay light: one place tells the day's story, and the newest line is the next step. The feedback loop is visible: a miss posts "Miss → weak spot · now 4 of 10" right under the question. Recall happens where he already is. Coach behaviour shows in the thread itself: she asks for his try first ("Just tell me ⌥↵" is logged), every fact has a source chip, plan changes are dashed, and the study plan stays hidden until he has rated his confidence.

**A day in it**
- 6:00 am: E.V. posts one line and the plan. He ticks items, reorders them (drag or ⌥↑↓), accepts the dashed suggestion, and presses S.
- 9:35 am: the review runs inline, one framed question at a time. Answers fold into one-line results, and misses become weak-spot lines.
- 11:43 am: he asks "is the mock exam ready?" and she answers from the job status, with the job line and a "from job status" chip.
- 2:40 pm: the morning post has folded to "Plan · 3 of 5 done · next…". The Exam 3 plan waits in the needs-you tray above the composer.

**Where cutover scope lives**
- **Day's plan:** E.V.'s morning post. It has the plan rows (review set, note tasks, approved plan sessions), the dashed suggestion, and a "Coming up" line with exam meters and the weekly review.
- **Practice:** inline in the thread, one question at a time; commit, then cited feedback. Library sets start it the same way.
- **Weak spots and exams:** each course channel. The study-plan proposal opens in the Detail panel (confidence first, then the dashed plan with a calibration line, then Approve / Ask for changes / Put away).
- **Ask E.V.:** the composer at the foot of Today and of each channel. ⌘K Tab hands a question to it.
- **Notes:** a real editor. It has the session bar (timer, read-along, pause, end), a tone step on the block being read, checks in the Detail panel answered in his words, and "Saved on this device".
- **Jobs and needs you:** Activity is still the one jobs list. Each job also posts one line in its thread, the sidebar foot shows the running job, and Today has the needs-you tray.
- **Accuracy line:** Library (sets plus the line). Progress is minimal. ⌘K is grouped Found / Jump to / Do, then "Hand it to E.V.".

**Trade-offs and risks**
- A thread scrolls, so the plan can drift out of view. The fold-to-summary line, with the next item and a Start button, softens this, but the full plan is one click further than on a list page.
- A chat-shaped home invites "just answer me". The guardrails above are the defence; watch the "Just tell me" logs after the switch.
- A long set (a 15-question mock exam) is cramped in a 572–640 px thread. It needs a full-column runner in Library, which isn't drawn here.
- Event, channel and Activity lines are pointers to one item, never copies. Past days fold to one line, and reading them isn't drawn.

**Plan impact (if chosen)**
- **Skeleton:** `areas/today` becomes the thread. Add `areas/courses`, one folder that renders a channel per course record (from course data, not one `area.ts` each). Remove `areas/ask` and merge it into the thread: the chat tools and `job_status` stay in `commands/`, and Thread, Post and Composer go into `kit/patterns`. `areas/library` narrows to sets plus the accuracy line; notes, progress and activity are unchanged.
- **Layout:** thread views get a fixed head (title and hairline) and a fixed foot (needs-you tray and composer). Detail and ⌘K are unchanged. ⌘J focuses the current composer.
- **Rule 6** becomes "one current E.V. line per screen": only her newest post is in full text; earlier posts drop to the quiet grey and fold to two lines; event lines are records, not speech, and carry no mark; when the Detail panel speaks, the thread's newest post steps down too.
- **Rule 3, clarified:** her mark is ember only when she's waiting on him and no primary action is on screen. The logo mark is quiet, and the needs-you dot uses the text colour.
- **New rule:** every job posts one line in the thread it came from. Dots are status only; the course colour dots are dropped.

**Kit classes added** ("Added for variant C", tokens only, 12/14/20 px only): thread `.tview .thead .tscroll .tfoot .tcol .thread .post .post.her.past .who .me-av .src`; lines `.evts .evt .gut`; plan `.plan .prow(.done .sum .grip) .upnext .ui`; foot `.needs .compose .hint`; channels `.tcol.chan .chan-sec`; other `.reading .d-text .navgap .nav.fresh`, and `.row:has(.sub)` gives two-line rows 48 px.

**Token changes:** none. Dark stays the default.
