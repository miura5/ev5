# Variant A · Calm desk

**Idea:** Matt's own description, done strictly: the current information architecture, raised to his spec for type, focus, motion, key hints, meters and ember.

**For Matt:** low decision load and trust. Each state has one ember action, with its key beside it (S, ↵, A, ⌘↵). He works before E.V. answers: Commit stays outlined until he picks, and Approve stays outlined until he has rated his confidence. Retrieval and self-rating come first, and they are what make studying stick.

**A day in it:**
- 6 am: four plan rows, one dashed suggestion, one grey line from E.V. He presses S, answers with 1–4, commits with ↵, and the cited feedback rises in.
- Between classes, the sidebar shows Activity "2". He rates his confidence on the Exam 3 plan and approves it with ⌘↵.
- Evening: a Ch 9 notes session. E.V.'s check waits in Detail, and the page says "saved on this device".

**Where cutover scope lives:**
- **Today:** the plan (study-plan items, review set, note task), the suggestion, upcoming exams, the weekly review.
- **Library:** Practice (Commit, then cited feedback), Weak spots, Exams (the row opens the proposal in Detail: confidence, then Approve / Ask for changes / Put away), Sets, the accuracy line.
- **Ask E.V.:** attempt first, "Just tell me" on ⌥↵ (logged). "Is it ready?" is answered from the job's row.
- **Notes:** the session bar (timer, read-along, Pause/End), checks in Detail, "saved on this device".
- **Jobs and ⌘K:** Activity (Needs you / Running / Done today, the failed job with Retry) and the sidebar job line. ⌘K: Tab hands the text to E.V.

**Trade-offs and risks:**
- It is the least new variant: it fixes polish, not structure. Today still lists everything; only the ember guides the eye.
- Key hints add small marks; the plan proposal carries three. The 2 px ring could feel loud on the always-focused composer.
- The note document and the ⌘K input are exempt from the ring, because the caret shows focus there.
- Gating Approve on ratings adds one step, on purpose.

**Plan impact (if chosen):**
- **UI rule 8** changes to: quiet key hints may sit beside actions.
- **UI rule 7:** two-line rows are 48 px; one-line rows stay 40 px.
- **UI rule 3, applied strictly:** the sidebar wordmark ring is grey, and needs-you dots are amber (`--warn`).
- **Activity** moves to the centred 720 px column. **Skeleton and scope:** none. Approve waits for all the ratings (§8 "confidence first").

**Kit classes added:**
- `.sec-head`, `.legend`, `.m-rest`, `.hint`, `.btn .kbd`, `.btn.primary .kbd`, `.btn.icon`, `.btn.primary:disabled`.
- `.msg .who`, `.chat-break`, `.composer-foot`, `.q-head`, `.q-foot`, `.nowrap`, and the keyframes `ev-fade`, `ev-rise`, `ev-toast`.

**Token changes:**
- **Sizes normalized in the kit itself:** nav 13.5 → 14; buttons, tabs, kv, steps and search 13 → 14; kbd, tag and `.num` 11 → 12; `.dg-lab` 11.5 → 12; tree 13 → 12; `.fact` 24 → 20.
- **New:** `--row2:48px`, `--icon:16px`, `--dur-1/2/3:150/200/250ms`, `--ease`, `--rise:4px`.
- **Changed:** `--side-w` 220 → 224; controls 32 px at 6 px radius (were 30 / 7); area radius 12 (was 10); pop radius 12 (was 14).
- **Focus:** a 2 px inset outline in `--text` (was 1.5 px `--quiet`). `prefers-reduced-motion` turns animation off.
