---
name: E.V.
description: A personal knowledge app with a partner built in, for one learner with any goal.
colors:
  ember: "#e0743a"
  on-ember: "#1a0d05"
  ember-hover: "#e8834d"
  side: "#101012"
  ground: "#151517"
  surface: "#1b1b1e"
  hover: "#222226"
  selected: "#2a2a2f"
  line: "#232327"
  line-strong: "#303036"
  text: "#ececef"
  quiet: "#a3a3ab"
  faint: "#92929a"
  ok: "#4cc27e"
  warn: "#d6a53c"
  bad: "#ec6a62"
typography:
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  hairline: "1px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "14": "56px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.on-ember}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  button-text:
    textColor: "{colors.quiet}"
    rounded: "{rounded.sm}"
    height: "32px"
  field:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "40px"
  row:
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "48px"
  nav-item-active:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "32px"
---

<!-- Written by Impeccable document (scan mode) on 2026-11-06 in the design channel's working copy.
     Derived from kit/tokens/tokens.css, the kit parts and design/mockup.html. The kit is the anchor:
     where this file and the kit differ, the kit wins and this file is regenerated. Light theme values
     live in tokens.css. No .impeccable/design.json sidecar is written, because the channel keeps one
     source of design truth. Qualitative lines were not put to Mathew; they come from the mock-up's own
     notes ("a calm desk") and are marked [inferred]. -->

# Design System: E.V.

## Overview

**Creative North Star: "The review desk"** (round 6: the shell shows what comes due against his dates, as a spaced-repetition app does)

E.V. is a dark graphite desk with one warm light on it. Everything Matt owns sits in plain rows on one surface; E.V.'s own voice and his one next action are the only colour in the room. The rail carries the Horizon: his dated items for the next 14 days, from the same read as Today's Coming up. Density is high and quiet: 14 px body, 40 to 48 px rows, no frames around lists, and one centred column of at most 720 px.

The system refuses decoration. There are no shadows on resting surfaces, no gradients, no badges and no colour-coding by type. Hierarchy comes from size, weight and the three greys. There are two signatures. The Horizon shows his dates for the next 14 days. E.V.'s mark is its name: it stands still and never shows loading or progress. Running work is a small pulsing dot. Nothing else moves on its own.

**Key Characteristics:**
- Two surfaces: a darker sidebar and the content ground, nothing nested inside.
- One ember element per screen: the main action or E.V.'s mark.
- Status only as a dot or a meter.
- Key hints on the main action and on the row in hand; ⌘K lists every key.

## Colors

Cool graphite neutrals with a single ember accent and three quiet meaning colours. (Cobalt was tried in round 6 and set aside on 2026-11-07.)

### Primary
- **Ember** (#e0743a dark, #b6541d light): the screen's one main action, and E.V.'s mark when E.V. is the newest voice. Never decoration, never a link colour, never a chart series. Dark text on it in dark (6.1:1); white on it in light (4.9:1).

### Neutral
- **Side** (#101012 dark, #f3f3f4 light): the rail, one step below the ground.
- **Ground** (#151517 dark, #fbfbfb light): the content area.
- **Surface** (#1b1b1e): the one framed thing being answered (study card, composer).
- **Hover / Selected** (#222226 / #2a2a2f): row hover and the active nav item.
- **Line / Line strong** (#232327 / #303036): hairlines and field borders.
- **Text / Quiet / Faint** (#ececef / #a3a3ab / #92929a dark; #1c1c1f / #4a4a4f / #6b6b70 light): the three greys, each a clear step apart, and faint passes 4.5:1 on every surface in both themes.

### Meaning
- **Ok, Warn, Bad** (#4cc27e, #d6a53c, #ec6a62): status dots. On the Meter only Bad appears, for real risk. Always with words or a legend beside them. Ok also marks a live session. There is no blue status colour.

### Named Rules
**The One Ember Rule.** One ember element per screen. When Detail has a primary action, the screen's own primary steps down.

## Typography

**Body Font:** Inter (self-hosted, 400/500/600), with system-ui fallback.

**Character:** one neutral sans, carried by size and weight steps, with tabular digits everywhere.

### Hierarchy
- **Title** (600, 20px, 1.25, -0.02em): page titles and the Detail title. The study card face is the one 24px exception (CONTRACT §ui.three-sizes).
- **Body** (400, 14px, 1.5): rows, messages, notes.
- **Label** (500, 12px): section labels, nav group labels, meta and counts (meta at 400).

### Named Rules
**The Three Sizes Rule.** 20, 14 and 12, with the card face at 24 as the one exception. Weight 600 only for titles.

## Layout

A fixed 224 px sidebar and one centred column (720 px with 40 px side padding). 56 px above the page title, 48 px between sections, 40 px rows (48 px with a meta line). An 8 px rhythm on a 4 px grid. A Detail panel of 400 px opens on the right for any item. Desktop Chrome at 1280 px is the target.

## Elevation & Depth

Flat by default. Depth comes from tone: the sidebar is darker than the ground. Only floating layers (⌘K, menus, toasts) carry a shadow: `0 0 0 1px #303036, 0 24px 60px rgba(0,0,0,.5)`.

### Named Rules
**The No Box In A Box Rule.** Only the thing being answered gets a frame.

## Shapes

Gently rounded and small: 1px for meter parts and step dashes, 4px for inline bits (key hints, source chips), 6px for buttons and nav items, 8px for fields, 12px for the content area and the study card. Nothing at 16px or more, and no pills.

## Components

### Buttons
- **Shape:** 6px radius, 32px tall.
- **Primary:** ember fill; dark text on it in dark, white in light; its key hint inside. Hover goes lighter in dark (#e8834d) and darker in light (#a24a18), so the label keeps 4.5:1. On an empty Today there is no Start next: E.V.'s mark takes the ember instead.
- **Text:** quiet grey label, hover to text colour; key hint beside it.

### Inputs / Fields
- **Style:** 1px line-strong border, transparent fill, 8px radius.
- **Focus:** a hairline in the quiet grey.

### Rows
- Glyph, title, one meta line, one value. No frame; hover tints the row; actions appear on hover or focus. The one action a row waits on (Try again, Restore, Start on the next item, Review plan) stays in sight.
- Every list is rows. There are no tiles.
- In a recall list (the terms under a set), the meta holds the answer and shows only on hover or focus.

### Meters
- **Meter:** 4px, ready, shaky and weak, with a legend (Today's readiness numbers per date). The parts are neutral (ready quiet, shaky faint at half strength, weak an empty part with a 1px faint outline, so it reads in light and dark). The weak part turns Bad only for real risk: weak spots before a dated goal in the next 3 days (so red keeps its meaning; weak cards are after cutover). The meta adds "at risk: 2 weak spots" (the date sits at the row's end), and the legend has four items: ready, shaky, weak and at risk.
- **Step meter:** one 12px dash per step: done in text grey, the step in hand quiet, the rest line grey.
- **Trend:** one series as a 2px quiet line, two hairline gridlines labelled in faint 12px, the current point filled.
- **Horizon:** the kit Horizon with show="dates", the first thing in the rail, under the search, as "Next 14 days": a faint baseline with a tick per day (a taller tick each week), today in quiet grey, and a quiet dot on each day that has a dated item. It reads only the Coming up read: no load bars and no card counts. One line under it names the first two dates ("Exam 3 Thu · Interview Nov 9", or "Nothing dated in 14 days"). Point at a day, or press H and step with ← →, and the line reads it out ("Thu 5 · Biology exam 3", or "nothing dated"); a ring marks the day being read, so it never looks like today. Esc returns focus. It opens Progress. The rail's rows never shrink; on short windows the rail scrolls under its foot (Recently deleted, theme, Keys), which stays in view. Load bars, card counts and the wide Horizon on Progress (the kit Horizon's default load mode) are after cutover.
- **Weak spots:** each row shows the glyph of its set, and "in today's plan" once C has added it. Add to plan C lives on Library's weak spots.
- **Pinned:** folders and notes only. No filters and no jobs. While E.V. works, the Activity nav item shows the pulsing dot. A collection page keeps its own Pinned section above Coming up (D-526); a pinned item is not repeated under Everything.
- **Tabs:** one style everywhere: quiet words, the chosen one in text grey with a 1.5px underline. Filters and study modes use the same look (TextOptions); no dot separators.
- **Key hints:** a key box shows only on the screen's main action and on the actions of the row in hand (and, in Detail, on its main action and the next open choice). Other actions keep their key in the tooltip and in ⌘K. Study is the exception: it is one card in hand, so its actions show their keys. Icon actions carry the key in their name ("Close (Esc)"). A key goes to the row in focus first, then to the open Detail, then to the screen. While a row has focus it owns the keyboard: a key it doesn't own falls through to Detail or the screen's own actions, never to another row or E.V.'s proposal, and those hints rest. E edits: on a set it opens edit mode, and on Today it edits E.V.'s proposal. E does not rename in place. While Detail is open, the screen's keys rest and their hints hide; while a row has focus, the screen hints it overrides hide. So a hint shows only where its key will answer. With no row in focus, a row's always-shown action (Open plan O, Try again R) answers from the screen when it is the only one with that key; when several rows show the same action, its hint shows only on the row in hand. "?" opens ⌘K with key hints, and the rail foot has a Keys row that does the same. It has two levels, like the rest of E.V.'s help: first "Keys here", headed with the screen's or panel's name and read from the screen's own buttons (no new read), then "Every key" from the registry key map (D-522). Type a letter or a word to find a key. The key map lists 1 2, ⌥↵, Space, ← →, ↵ and Esc with where each works. With a row in focus, "Keys here" lists that row's own keys first. In the empty Ask box, "?" opens it too. The Keyboard sheet (kit KeySheet) is after cutover. Choices inside Detail take keys too (Y keeps, N drops, Y or N confirms, 1 2 3 rates); a choice already made is skipped, so the same key steps to the next open one.
- **One key map:** every letter lives in one key map, the same one the build uses; the hints, the sheet and ⌘K all read from it, and a test fails if a letter has two meanings.
- **One letter, one meaning:** D drills, E edits, L marks learned, O opens, R tries again or restores, S starts, T moves to tomorrow, W hands the work to E.V., Y and N are yes and no (Y accepts E.V.'s proposal), C creates (a new thing, or a plan line from a weak spot) and ⇧ a bigger one (⇧C a collection, ⇧D a date), ⌘J always asks E.V. (Ask for changes too), X marks done, ⌘↵ finishes (approve, save, end a session). Stop has no key: main has none, and a stop can't be undone. No letter means two things.
- **Blocked actions:** a disabled main action looks disabled (faint, no border) and says why beside it, with the key that unblocks it ("3 left to rate · 1 2 3 rates the next"). ⌘↵ on it moves focus to the first open choice. Enter on an empty study try says "Write a try first, or press ⌥↵ to be told."
- **Restraint:** unset properties are hidden; one faint line under the set ones names them ("Add time · repeat"), and each word opens just that row, laid out like the others. Each fact is said once (the estimate lives in its row, not the head). A notice does not repeat E.V.'s line. Counts use digits. Plain values are plain text, not chips. The rail is the same on every screen, and every screen title sits at the same height.
- **Done settles:** X paints done at once; the row keeps its place until you move on or the Undo notice ends, then joins the done rows at the end of the list.
- **New things appear where you are:** C adds the new line below the row in focus, or at the end with none. Esc removes it and returns focus to that row.
- **One focus:** while Detail is open, the other rows step back (titles quiet, meta faint). Nothing moves and no frame is added.
- **Ask:** the transcript scrolls in its own space a full section gap under the head, with a short fade at its top edge.
- **Focus comes home:** closing a panel returns focus to the row that opened it; a settled done row leaves focus in its slot, on the next open item. Going to another screen does not pull focus back.
- **Renaming:** the Rename button in Detail, or a click on the title, selects it inside a quiet 1px field line. It has no letter yet; it may sit inside E's edit later. Enter saves with "Saved · Undo Z" and moves focus to the panel's main action; Esc puts the old title back.
- **Put away:** an E.V. proposal's panel has no Put away button; its × reads "Put away (Esc)" and Esc does the same, so the panel's actions keep one line.
- **⌘K finds keys:** a one- or two-letter query matches word starts only, and a query that is a key puts that key first. Each key row says where it works ("on a row", "anywhere", "while an Undo notice shows"). C in ⌘K makes what fits the screen, as C does.
- **The rail's place:** the screen you are on is the selected fill with medium weight, so it reads in light too.
- **Just tell me (⌥↵):** belongs only to a question nobody has answered yet; it leaves an E.V. turn once you write back, and E.V. answers your try. It logs once, inline ("Logged: you asked for the answer first."), with no notice and no Undo, and E.V. answers from your notes or says they don't cover it. With no open question, ⌥↵ says so. On Ask, notices sit above the message box.
- **E.V. answers your try:** a close try gets "Right idea", a wrong one "Not quite" and the answer, and "no idea" gets "No problem, here it is". A message that ends in "?" is a new question, not a try.
- **Leaving Study:** with a try typed, any way out (Esc, ⌘J, ⌘K, the rail) first says "Do that again to leave. Your try is not kept." The second press leaves.
- **Study logs without Undo:** a rating shows a notice that says what happened ("Good · next card", "Again · it comes back tomorrow"), so a slip is seen; Just tell me logs inline. Neither has Undo. Turn over stays a live primary on an empty card and asks for a try. ⌥↵ with a try typed turns over and keeps the try. Typing again resets the leave guard, so a second Esc never drops an edited try. Undo stays on registry commands that have undo (D-522). Undo on ratings and talk is after cutover.
- **Done rows settle when the notice ends,** not on a timer, so Undo never chases a moving row.
- **Why-lines** sit on their own reserved line under the actions, so nothing moves when one clears. A blocked main action is faint text in its place, with no outline.
- **Keys in ⌘K:** "?" works anywhere except while typing, Study included. Esc closes ⌘K and puts focus back where it was.
- **Focus after a key:** a key that acts in Detail keeps focus in Detail, on the next open choice or its main action. A key that acts on a row keeps focus at that place in the list. Focus never jumps to a row nobody chose. Only the next open choice shows its key hints.
- **Pickers:** an inline picker (a note's collection, a set's source) is quiet text with a solid underline on hover. Dashes stay E.V.'s.
- **Undo:** a change that can be taken back shows a toast with "Undo Z" for 8 seconds; it holds while the pointer or focus is on it. Only commands with undo in the registry show it: Approve plan, Confirm weak spots, Save the set, Restore, Keep or Drop, Saved, and done. Stop, ratings and talk show a plain notice with no Undo.
- **Stopped job:** main's state. Stop asks twice (press the button again within 4 seconds, the same pattern as the Study leave guard), and the panel says "Press twice. It stops now and can't be undone." Stop has no key. It then marks the job failed with "Stopped by you.", a bad dot, "stopped at 9 of 15" in its steps and "Not finished" as its output; it sits in Needs you with Try again R. There is no Undo on Stop and no "Open the draft". Drafts that landed before the stop stay in Library (ev-build to confirm).
- **Approve:** Approve plan is always enabled. The plan shows no confidence rating row. Once approved, the panel's head says "Approved", its list reads "In your plan", the × is Close, and Esc is a plain close that leaves the Undo notice up and puts focus back on the row that opened it.
- **Durations:** one form everywhere: "10 min", "1 h 20 min". Scores: "3 of 5 right".
- **No repeats:** a fact is said once per screen. Today names a date in Coming up and on the Horizon, not in E.V.'s line. Activity counts sit on its sections and in the nav, not in its head. A note's crumb, collection and actions share one toolbar line above the title.

### Loading
- The pulsing dot (kit Dot, pulse) and one quiet line. No skeletons, no shimmer.

### Navigation
- 32px items, quiet text and 16px line icons; the active item gets the hover tone and text colour; counts at the right in faint 12px.

### E.V.'s mark (signature)
- The Consolidate symbol's small cut. **Logo:** 20px in text grey beside the name. **Voice:** 16px, ember when E.V. is the screen's one accent, faint otherwise.
- **Persona:** E.V. is "it", never "she" or "her" (Matt's choice). Where "it" reads awkwardly, say "E.V." ("E.V. wants your try first", "Ask, or answer E.V.").
- **Still:** the mark is brand only. It never animates: no arrive, no thinking wave, no step count. The kit Mark has only quiet and logo; its step and arrive modes are removed, and JobLine leads with the Dot with pulse.
- **Running work:** a small quiet dot that pulses (kit Dot, pulse; --dur-think). It says "Step n of N" to assistive tech, and the row's meta says it in words ("writing questions, 9 of 15"). Still under reduced motion. Every job row shows the glyph of what it makes, never the mark and never a job glyph; a running row adds the pulsing status dot. Seven glyphs in all, one per kind of thing.

## Do's and Don'ts

### Do:
- **Do** take every value from kit/tokens/tokens.css.
- **Do** put a key box on the main action and the row in hand, and every key in ⌘K.
- **Do** keep E.V. to one line per screen, cited.

### Don't:
- **Don't** use purple, gradients, glow, card shadows, badges, emoji, sparkles or pill buttons.
- **Don't** frame lists or nest boxes.
- **Don't** colour-code item types.
- **Don't** add a kicker or eyebrow above a heading.
- **Don't** use the mark as an icon for anything but E.V.'s name and voice. Never for loading or running work.
- **Don't** animate the mark.
- **Don't** use red on a meter unless a dated goal is at risk.

## After cutover

These parts are in no screen of the final mock-up. They wait until after cutover, because main's round 7 skeleton has no read, command or table for them. Do not add them back before cutover.

- **Horizon load bars and card counts** (rail and Progress), and the wide Horizon on Progress. Needs a per-day due read.
- **Keyboard sheet** (kit KeySheet overlay). "?" opens ⌘K with key hints instead.
- **Drill next** on Progress. It repeats Library weak spots.
- **Confidence rating row** on the plan, and Approve blocked until it is rated.
- **Undo on Stop**, a stopped job's output kept as a draft, and "Open the draft O".
- **Undo on ratings and talk** (Study ratings, ⌥↵ in Study and on Ask).
- **Saved views** in Pinned and the "due" view. The pin data keeps its other kinds, so saved views can come back as their own group.
- **Jobline** in the rail foot.
- **"New view" command** in ⌘K. It makes a saved view, so it waits with saved views.

