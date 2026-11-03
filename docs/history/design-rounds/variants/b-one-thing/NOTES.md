# Variant B · One thing now

**Idea:** home is one quiet statement of the next block with one Start, and starting a block takes the chrome away until Matt presses Esc.

**What it optimizes for Matt, and why it should help him learn**
- No choosing at the moment of starting: the next thing is already named, so the press of ↵ beats putting it off. "Something else" (E) is one key, so he isn't trapped either.
- Retrieval with nothing else in view: practice and sessions fill the window, with no tabs, counts or job lines to pull him away. E.V.'s checks come one at a time, below the work.
- He stays in charge: the rest of today is his list (drag, ⌥↑↓, "Make next"). E.V.'s ideas are dashed until he accepts them. The plan proposal shows how he's actually done beside each confidence rating.

**A day in it**
- 9:40, between classes: opens E.V. and sees Now say "Oral liquid doses · 10 problems · 20 min". He presses ↵, and only the question and a thin timer line are left.
- He misses one. The cited feedback appears, then E.V. asks him to say the rule back in a line. He answers, presses ↵ for the next one, and Esc when he's done.
- 2:15, after clinical: he drags the note session above the review and starts it. He reads along, answers her Frank–Starling check in his own words, and sees "Saved on this device".
- At night, "2 need you" in the bar takes him to Activity. He rates his confidence on the BIO 201 Exam 2 plan and approves it.

**Where each cutover-scope item lives**
- Day plan: **Now**. It has the next item, his reorderable list (review set, plan tasks, note tasks), one dashed suggestion, and Coming up (exams, weekly review).
- Practice: **focus** (`#practice`), opened from Now or from Library › Practice. One question, commit, then cited feedback. Hint and "Just tell me" are both logged.
- Weak spots, exams and sets: **Library** tabs (Practice holds Ready and Sets, then Weak spots and Exams).
- Study-plan proposal: a **page** (`#plan`). Confidence comes first, and the plan stays hidden until all items are rated. A sticky Approve / Ask for changes / Put away bar sits at the bottom.
- Ask E.V.: the **Ask** tab. She asks for his try first, and answers "is the mock exam ready?" from the job's steps.
- Notes and study sessions: **Notes**, then the note, then **focus** (`#session`). The strip holds the timer, read-along, Pause and "Saved on this device". Checks sit under the note.
- Jobs and needs you: **Activity**, reached from the bar's job line or "2 need you", and from ⌘K. Each job opens as a page with its steps.
- ⌘K: the main way around. It holds Next, the commands, Go to (1–4 for the tabs) and Tab to ask E.V. Progress is minimal and reached from ⌘K or Library's accuracy line.

**Trade-offs and risks**
- Less overview at a glance: exam readiness and weak spots are one tab away, not beside the plan. He might miss a slipping exam (the E.V. line and Coming up are the guard).
- Activity and Progress have no tab. If Matt doesn't use ⌘K, Progress is easy to forget.
- Focus mode hides the needs-you count. A plan that waits all day is fine; something urgent would need a toast rule.
- The no-sidebar shell departs from the base mock-up, so the kit's Sidebar component and every sidebar screenshot are replaced.

**Plan impact (if chosen)**
- Layout regions (PLAN §7): 1 Sidebar becomes a **Top bar** (mark, tabs from `areas/*/area.ts` with `nav: "tab" | "bar" | "palette"`, job line, needs-you count, ⌘K). 2 Area stays as is. A **Focus** layer is new: a full-window state any area can enter, with a timer line and Esc.
- **Detail panel → Detail page:** the `patterns/Detail` survives, but it renders as a full-width page with Back/Esc, not a side region. UI rule 1 becomes "the shell tone and the working surface".
- Skeleton: the same `areas/*` folders with different navigation. Rename `areas/today` → `areas/now` (UI label "Now"). `ask`, `library`, `notes`, `activity` and `progress` are unchanged, with Activity in the bar and Progress in ⌘K only. No area is added or removed.
- Cutover scope: unchanged.

**Kit classes added** (section "Added for variant B"): `topbar`, `brand`, `toptabs`, `barlink`, `barsearch`, `surface`, `col.narrow`, `btn.text.back`, `col.now`/`next` (the next-thing statement), `row.dim`, draggable row grip, `row.drop`, `decide` (sticky proposal bar), hover-only `suggest .act`, `focus`, `timeline`, `strip`, `focus-scroll`/`focus-col`, `after`, `blk.reading`.

**Token changes:** none. Dark is the default, and type stays at 20/14/12.
