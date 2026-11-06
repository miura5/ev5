# E.V. v5 · design hand-back: change list for the plan

**Approved by Matt on 2026-11-03** (round 7). The reference is `design/mockup.html`. Its evidence (interaction map, trace to PLAN and the brief, open questions) is in `design/mockup-audit.md`.

Under PLAN §7, the approved mock-up wins on looks. The rules below replace PLAN §7's UI rules once the architect has folded them in and they move into CONTRACT.md. The scope lines carry Matt's yes, given by his approval.

```
skeleton:  areas/* unchanged (six areas: today, ask, library, notes, progress, activity).
           Sidebar region: "then Courses" → Matt's pins (PLAN C12), plus a Recently deleted link
           at the foot.
           Notes area: a home list (recent, then collections as folding rows nested one level) and
           one centred page per note. No list and doc side by side.

rules:     + Every item Matt owns (plan item, note, set, date, collection, saved view) can be
             created, edited and deleted by hand, from where it lives.
           + Delete → Recently deleted for 30 days, with Undo and Restore. No "delete forever".
             Jobs are never deleted.
           + Where E.V. can help, there is one quiet "with E.V." action beside the manual one.
             Her output arrives dashed and cited, in the list it would change, and Matt keeps or
             drops each piece.
           + Keys: C creates the thing the screen holds · E edits a set · ⌫ deletes ·
             . or right-click opens the item menu · P pins · M moves · S runs Detail's primary action.
           + Titles and properties edit in place. Properties live in Detail; exception: a set's
             collection and source sit on its Edit page.
           + A set has one page with two modes (view and Edit). No separate editor screen.
           + An item sits in at most one collection. Collections nest one level. Deleting a
             collection leaves its items, ungrouped.
           + Weak spots come from Matt's misses: E.V. proposes, Matt confirms. "Mark as learned"
             is a status, not a delete.
           ~ PLAN §7 rule 8: key hints also sit quietly beside actions, not only in tooltips and ⌘K.
           = PLAN §7 rules 1–7, 9 and 10 hold as written (checked in mockup-audit.md, Part B).

scope:     Cutover (PLAN §8) unchanged in content. How the mock-up shows it:
             - weekly review = a "Needs you" job in Activity on Sundays, not a line on Today;
             - weak spots on the Library home and on a date's Detail;
             - the retrieval-accuracy line under the Library title.
           After cutover (shown in the mock-up, shipping later):
             - card sets and step sets, with due counts and Again / Good (with FSRS, PLAN §5.7, C3);
             - Learn and Test modes;
             - saved views;
             - rating confidence before approving a prep plan (Matt-first planning, C9);
             - the phone layout (the phone stays as it is, PLAN §2.2).
           Matt's yes: given by approval on 2026-11-03.

kit:       Button: primary (one per screen), secondary, text, icon; key hint beside
           Field: bordered input, segmented choice, borderless cell (titles, set editor)
           Row: glyph · title · one meta · one value; folding variant; two-cell editor variant
           Tile: a set in the Library; no tint, cover or bar
           Glyph: eight line glyphs (note, card set, question set, step set, plan item, job,
                  collection, date); plan and job rings carry status
           E.V. line: dotted mark, one sentence, its source
           Suggestion: a dashed row; a proposal on Today, a draft in the set editor
           Source: "from Note · …" chip, or "unverified"
           Study card: face, attempt, reveal with source, Again / Good; also the set's hero card
           Text options: filters, set types, study modes as quiet words
           Detail: one panel; title and properties in place; ⋯ menu
           Menu: item actions and every picker (collection, link, source)
           ⌘K palette: commands, found items, pins; Tab hands the text to E.V.
           Toast: one line, with Undo
           Doc: the note page; session bar and checks only during a session
           (vs PLAN §7 first set: adds Tile, Glyph, Source, Text options; folds Shortcut hint into
            Button and Job card into Row; drops Sheet and Meter until an area needs them)
```

## Open for the architect (from mockup-audit.md, Part C)
1. **Storage for each new thing: settled.** v5 keeps its record in its own database, one table per kind (§data.own-db, §data.tables), so each of these has its own table, with export and restore-drill coverage:
   - collections of any kind, and nesting;
   - pins and saved views;
   - plan-item time, repeat and linked item;
   - dates of any kind, each with its kind;
   - set items typed by hand, and step sets;
   - E.V.'s pending drafts;
   - "Mark as learned".
2. **"Write with E.V." / "Make cards":** is this the practice-set job writing drafts into a set (fits PLAN §6.4), or a new job kind?
3. **The command registry list** that the interaction map implies (PLAN §6.1).
4. **The kit's first set,** reconciled with PLAN §7.
5. **Weak spots have no glyph:** confirm that, or add a ninth.
