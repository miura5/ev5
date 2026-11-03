# H · Console

**In one line:** E.V. is a calm console. There is one column of output, newest at the bottom, and one line to type on. E.V. speaks as lines in the stream, and ↵ always runs the one highlighted default.

## The Proprietary (its design system)
- **Palette:** soft blue-black `#13151a`, a lifted ground for focus, and three warm inks (≥4.8:1 on every ground). One ember accent `#eba564`, only on the default action and E.V.'s mark. Light theme "paper terminal": cream `#f3eee2`, brown-black ink, burnt ember (`\` switches). `#system` computes contrast live.
- **Type:** IBM Plex Mono for structure; IBM Plex Sans for reading (notes, card faces, E.V.'s voice). Three sizes, 20/15/13, and two weights. Hierarchy comes from ink level, not size. Italic mono marks "logged" lines.
- **Grid:** vertical space in 24 px lines, horizontal in characters (`1ch`/`2ch`/`4ch`), so rows align like a terminal. One 720 px column; timestamps hang in the left gutter.
- **Shape, depth:** square corners, 1 px hairlines, dashed lines for anything pending. Corner-ticked frames only on the thing being answered. Radius 3 only on keycaps and floating layers; one shadow, only on the palette and completions.
- **Motion:** fades only (120 ms lines, 180 ms views and card turns). Nothing blinks, slides or types itself out; reduced motion sets both to 0.
- **Signatures:** a command line with a ghost of the default and completions that teach the syntax; output blocks (Tab or ↑↓ to focus, ↵ to open); status as glyph shape (○ ◐ ● ◆ ×, never colour); character-cell meters; `[source]` brackets and a dashed "unverified" ring; dashed proposals with `[accept] [edit] [dismiss]`.

## Why it fits Matt
- **Keyboard-first, literally:** everything is reachable by typing, and each screen has one highlighted next step, so decisions stay light.
- **Precise and calm:** aligned columns, real numbers, a source on every fact, monochrome ink and empty space above the newest output. Precision reads as reliable.
- **His own:** the kind of tool a science student would build for himself (Peter Parker). Plain-word commands and prose output keep it from feeling like hacker cosplay.
- **Coach, not crutch:** E.V. asks for his attempt first. "just tell me" (⇧↵) is quiet and logged in the stream. Her changes stay dimmed until he accepts them, and the exam plan asks for his confidence before drafting.

## The carousel without becoming carousel-driven
`study` takes the column and shows one large card, framed because he is answering it. Neighbours show only as two hairline card edges, with tick dots and `‹ 3 / 12 ›` for position; ← → move. He types an attempt and keeps it with ↵. Space then cross-fades to the cited back, with his own words beside the answer and one line from E.V. He rates `a` again or `g` good. The deck list is a plain table, never a row of tiles.

## A day in it
- **9:12** `› today` shows E.V.'s line, four plan rows, one pending proposal, exam readiness and the week review. ↵ starts the review set.
- **9:16** `ask why…`: she asks for his try first, then confirms it with sources. "Is the mock exam ready?" gets an answer from the job: 14 of 40 written.
- **11:00** `notes ch9`: a session bar with a timer and read-along, a check question answered in his words, "saved on this device".
- **Evening:** the header shows ◆ 1 needs you. `jobs` opens the exam 3 plan; he reads the dashed proposal and approves it with ↵.

## Risks, and how it ages
- **Typing as the main mode** may feel like work on a tired night. Every block also clicks, ↵ always does the obvious thing, and ⌘K finds anything.
- **A bottom-anchored stream** can push the plan out of view. Older output folds to one line, and `today` re-prints the plan.
- **Mono-heavy screens** could read as a developer tool. Plex Sans prose is the guard; watch whether Matt reads it as his. Long tables (a 40-question review) need a pager, which isn't drawn here.
- **In five years:** terminals and type specimens have looked like this for decades, and there are no gradients, glass or trendy radii to date it. The likeliest thing to age is Plex itself, and swapping it is a token change.

## Areas mapping
today → `today` (the default stream) · ask → `ask …` in the stream (non-commands go to E.V.) · library → `cards`, `study`, `practice`, `weak` · notes → `notes ch9` (focused view plus session bar) · progress → readiness meters and the week review in today (minimal) · activity → `jobs`, plus the header glyphs on every screen · exam plan → `plan exam3`.

## Plan impact (if chosen)
- **S-70 Shell becomes "Console shell"**, in place of a sidebar with a Detail panel: the header, a stream of focusable blocks, a focused-view takeover with Esc to return, the command line with completions and a ghost default, and ⌘K. `area.ts` registers **commands** (verb, args, completion, view), not nav items, so one registry drives both the UI and E.V.'s tools.
- **Kit (S-20/S-2x):** tokens become the three sizes, the line grid and ch spacing. New components: CommandLine, Completions, Block, Row, Meter, StatusGlyph, Source, EvLine, Proposal, Frame, Keycap, FocusedView.
- **Areas (Phase 5):** Today, Library lists, Ask and Activity output stream blocks. Study, Practice, Plan and Notes are focused views. The e2e journeys also assert keyboard paths (type, ↵, Esc).
