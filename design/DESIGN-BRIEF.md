# E.V. v5: design brief (round 4 onward)

> **Status: approved on 2026-11-03 (round 7).** The reference is `design/mockup.html`. What it changes in the plan is in `design/CHANGELIST.md`, and the evidence is in `design/mockup-audit.md`. This brief is now history for looks; once the architect folds the rules into PLAN §7 and CONTRACT.md, those files hold them.

This file is the one source for anyone designing E.V.'s UI, and it replaces every earlier brief. The rounds before it (`variants/`, `directions/`, `round3/`) are history: look at them to learn, never to copy.

## 1. What E.V. is now
A **personal knowledge app with a study partner built in**.
- E.V. serves one independent learner: school, a certification, an interview, a career move, or learning for its own sake.
- It must never force a workflow or a worldview on the user: no built-in courses, semesters or student mode.
- A subject is just what the user puts in it.

The skeleton from the plan stays: **Today · Ask E.V. · Library · Notes · Progress · Activity**, plus ⌘K and a Detail panel.
- The words are deliberately general.
- What the sections mean doesn't change: Today is the day's plan, the Library holds things he studies, Notes holds what he writes, Activity holds what E.V. is doing.

The coach rules from `PLAN.md` §1 still hold:
- he tries before any answer is shown;
- every fact cites a source;
- E.V. proposes and Matt decides.

## 2. What every earlier round taught us
| Round | Kept | Dropped |
|---|---|---|
| **A–D** (one shared system) | A's spacing (8 px rhythm, about 48 px between sections, a centred column of at most 720 px, sidebar + column + Detail); graphite, one ember accent, Inter at 20/14/12; dashed proposals; E.V. as one quiet line with a dotted mark; quiet key hints beside actions | Every item looked the same, a "sea of rows"; it felt shallow, especially the Library |
| **E–H** (four personalities) | One card in focus when studying; attempt first, then flip; E.V. beside the work, not on top of it | Display serifs and monospace UI text (hard to read for more than a minute); metaphors and textures; anything that reads as flashy |
| **I–L** (object language) | Each kind of thing should be recognizable; the Library is set-based, Quizlet-like (a set page with study modes, one card in focus, a term list); notes like Quip | Too many tints, chips, pills, meters, covers and panels: noisy and busy. "Courses" became a default because Matt said he liked it once. A liking is not a rule. |

**The lesson in one line:** A's frame and calm, plus *just enough* object language to tell things apart, with nothing added that hasn't earned its place.

## 3. Design rules for this round
**Structure:**
1. The six skeleton sections, a sidebar, one centred column, and a Detail panel that opens on demand. No new top-level sections.
2. The sidebar holds the six sections plus Matt's **pins**. A pin can be anything he chooses: a note, a set, a collection, a saved view.
   - There are no built-in domain sections.
   - A collection in the sidebar is one the user made and pinned: "Biology" next to "Spanish", "Interview prep" or "Running". No course code is needed.

**Customization comes from a few general primitives, not from settings:**
- **Collections:** one way to group anything. They nest at most one level.
- **Properties:** on plan items and sets (date, time, estimate, repeat, linked item). Properties live in the Detail panel, not inline on every row.
- **Saved views:** a filter plus a sort, which can be pinned.
- No settings pages for layout. If something needs a toggle, question whether it should exist.

**Object language (tasteful, not loud):**
- **One monochrome line glyph per type**, 16 px, in the text grey. The types are note, card set, question set, step set, plan item, job, collection, date (an exam, a deadline, any goal with a date).
- Types differ by **glyph and form**:
  - a note is a document row with a one-line preview;
  - a set is a tile in the Library and a row elsewhere;
  - a plan item is a row with a status ring;
  - a job is E.V.'s dotted ring with a step count.
- **No per-type colours, no covers, no tinted tiles.** Colour stays: one accent for the single primary action and E.V.'s mark, plus small status dots and thin meters.
- **Rows show at most:** glyph · title · one quiet meta · one right-aligned value. Everything else goes in Detail.

**Screens:**
- One primary action per screen, three sections at most, generous empty space. If a screen feels busy, remove something.
- Study modes (cards, questions, steps) are full-focus: one thing on screen, attempt first, then the reveal with its source.

**Type and colour:**
- Inter (or a near twin), sizes 20 / 14 / 12, plus one large size only for a card face if needed.
- No serif, no monospace in the UI.
- Dark first with a matching light theme, both readable.

**Features must earn their place.** In this round, leave out:
- mastery bars on every tile;
- calibration views;
- weekly-review panels;
- course covers;
- streaks or gamification;
- Match/Learn/Test beyond what the set page needs to show "study modes exist".

Each can come back later only with a reason.

## 4. Keywords
- **Mood:** calm, quiet, simple, modern, timeless, restrained, spacious, legible, personal.
- **Structure:** the original skeleton, one column, Detail on demand, pins, collections, saved views.
- **Objects:** one glyph per type, recognizable form, monochrome, nothing decorative.
- **Behaviour:** keyboard-first, focus on one thing, quiet until hovered, attempt before answer, E.V. proposes and Matt decides.
- **Avoid:** busy, noisy, dashboard, chips everywhere, colour-coding, covers, tinted tiles, gamified, school-only, workflow-imposing, flashy fonts, metaphors.

## 5. Screens for a round (keep it to these)
1. **Today:** the plan as rows, one E.V. line, at most one dashed proposal, and dates coming up (a single short list).
2. **Library:** the home (recent at the top, then all sets with one filter row by type: Cards · Questions · Steps); a set page (title, count, source, one primary "Study", the modes as quiet text options, a hero card, the item list); study mode (one card in focus, attempt, reveal with source, Again / Good).
3. **Notes:** collections on the left (Quip-minimal), a doc list, and a clean doc. A session bar appears only while a session runs.
4. **A collection** the user made (e.g. "Biology"), showing its notes, sets and dates mixed. A second collection from another kind of learning (e.g. "Interview prep", "Spanish" or "Running") shows that any subject fits.
5. **Ask E.V.:** attempt first, and "is it ready?" answered from a job.
6. **Activity:** jobs: needs you, running, done, failed with a reason.
7. **Detail panel** on a plan item, showing its properties.
8. **⌘K.**
9. **`#system`:** tokens, type, spacing, the eight glyphs, and the few components (aim for 15 components or fewer).
10. Optionally, **one phone frame** of the Library home and a card in study mode (the phone will centre on the Library later).

Synthetic content only. Sample content is any subject (§what.framing). Desktop at 1280 × 860.

## 6. How a round works
- **2–3 mock-ups, not more,** that differ on **named dimensions** only, so the differences are visible but purposeful. Pick from: dark vs light first; how sets appear in the Library (tiles vs rows); where E.V. speaks (an inline line vs the Detail margin); how strong the glyph and form language is (minimal vs slightly richer).
- Say up front which dimensions differ, and keep everything else the same.
- Start every mock-up from `reference/a-calm-desk.html` (A), changing only what the round tests. A's spacing is the baseline.
- After each round, Matt reacts in plain words. Restate his ask in one line. **A liking is a preference for that mock-up, not a rule for every mock-up.** Only turn something into a rule when he says so.
- If an ask would add busyness, say so in one line and offer the simplest version.

## 7. Hand-back (when Matt says "approved")
1. The final `mockup.html` (it becomes `design/mockup.html`).
2. A change list for the plan:
```
skeleton:  changes to areas/* or layout regions (aim for none)
rules:     UI rules that changed (PLAN §7)
scope:     anything added to or removed from cutover (PLAN §8), with Matt's yes
kit:       the components, one line each
```
