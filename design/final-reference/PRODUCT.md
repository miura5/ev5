# Product

<!-- impeccable:product-schema 1 -->

<!-- Written by Impeccable init on 2026-11-06 in the design channel's working copy, not the repo.
     Source: CONTRACT.md and PLAN.md at commit 5ed85bc. Init's interview did not run: Mathew asked
     for the whole command set in one pass, so each fact below is taken from those two files and
     marked (from CONTRACT §id / PLAN §n). Lines marked [inferred] are mine and need his yes. -->

## Platform

web

## Users

One person: Matt, an independent learner with any subject or goal (school, a certification, an interview, a career move, or learning for its own sake). He is the only user. (CONTRACT §what.framing, PLAN §1)

He uses E.V. on desktop Chrome at 1280 px as an installed app. The phone only has to work; it gets no layout or polish work. (CONTRACT §ui.targets)

## Product Purpose

E.V. is a personal knowledge app with a partner built in. It plans the day, writes and runs practice, tracks weak spots against upcoming dates, keeps notes and sessions, and talks with Matt as an agent. (PLAN §1)

Every feature serves one loop: notes → practice → errors → weak spots and review → today's plan → back to practice. A feature that does not serve the loop waits. (CONTRACT §what.loop)

Success means Matt does the retrieval and the planning himself, and E.V. proposes, questions and checks. A design that does his thinking for him is a defect. (CONTRACT §what.loop)

## Positioning

E.V. is a coach, not a crutch. She asks for his attempt before she explains, she proposes and he decides, and every fact she states cites his own notes or sets, or is marked "unverified". (PLAN §1, CONTRACT §ev.cites, §ui.attempt-first)

Nothing about any subject is built in. Courses, exams and units are his own data: a course is a collection he names, and an exam is one kind of date. (CONTRACT §what.framing)

## Operating Context

- Five regions: sidebar, one centred content column (at most 720 px), a Detail panel, ⌘K, and Activity. (CONTRACT §ui.layout)
- Keyboard first: C creates, E edits, ⌫ deletes, S runs the primary action, X toggles a plan item, Esc leaves; hints sit beside actions. (CONTRACT §ui.keymap, §ui.keys)
- Long work runs as jobs with states queued, running, needs you, done or failed, shown in Activity. (CONTRACT §job.record)
- Study sessions: one question at a time, his attempt first, "just tell me" one key away. (CONTRACT §ui.one-question, §ui.attempt-first)
- [inferred] He works in long focused evening sessions before dated goals, often in a dark room.

## Capabilities and Constraints

- The approved mock-up (design/mockup.html, round 7) wins on looks; CONTRACT.md wins on rules. (CONTRACT §ui.mockup)
- The kit owns every pixel. A new look starts in kit/, and values come only from kit/tokens/tokens.css. (CONTRACT §ui.kit-leads)
- Two surfaces only, sidebar and content, and no boxes inside boxes. Lists have no frames. (CONTRACT §ui.two-surfaces, §ui.lists)
- Three text sizes (20, 14, 12) and three greys; weight 600 only for titles; the study card face at 24 is the one exception. (CONTRACT §ui.three-sizes)
- One accent element per screen: the main action or E.V.'s mark. The accent is ember. Matt tried cobalt in round 6 and chose ember again on 2026-11-07. (CONTRACT §ui.one-orange)
- Status shows only as a dot or a meter. (CONTRACT §ui.status)
- 8 px grid, 40 px rows, 48 px between sections. (CONTRACT §ui.grid)
- Eight line glyphs, one per item type, no colour-coding; a row shows at most four things. (CONTRACT §ui.glyphs)
- E.V. speaks once per screen; her suggestions are dashed, in the list they would change. (CONTRACT §ui.ev-once)
- Delete goes to Recently deleted for 30 days; no "delete forever". (CONTRACT §ui.delete)
- A tap paints its new state at once; a refused write shows "not saved". (CONTRACT §ui.instant)

## Brand Commitments

- Name: E.V. She is "E.V.", and the app says "you" to Matt, never "the student". "Study" is a verb, never part of a thing's name. (CONTRACT §what.framing)
- Voice: short and plain, leads with the point; on a study question his attempt comes first; she insists once, with a reason, then respects his call. (CONTRACT §ev.voice)
- Mark: the Consolidate symbol from Matt's logo kit (small-size cut in the app, full symbol on the app icon), with its Thinking wave as the one running sign. Chosen by Matt on 2026-11-06 in this channel.
- Design system: Proprietary, E.V.'s own. Ember accent, dark first, Inter. Not a framework's look. (PLAN §7)
- Accent: ember, #e0743a on dark and #b6541d on light: the main action and E.V.'s mark. Matt tried cobalt (#6FA8FF, #2F6FDB) in round 6 and chose ember again on 2026-11-07. The cobalt boards stay as a record.
- Brand guide ban list (this channel's Doc): no purple, no gradients or glow, no corners of 16 px or more, no pill buttons, no card shadows, no badges, no emoji, no sparkles, no AI imagery, no hover lift, bounce, shimmer or typing text.

## References

Confirmed by Matt on 2026-11-06 (he took the coordinator's picks):
- Learn from: Things (calm), Anki (study), Obsidian or Logseq (notes).
- Avoid: anything that reads as Notion or Linear, and the brand guide's "not us" list.
- Must stay: the attempt-first study card, E.V.'s dashed proposal row, and one accent element per screen.

## Evidence on Hand

- The approved mock-up: design/mockup.html with realistic sample data (Biology exam 3, Cardiac output terms, Spanish, a half marathon). All sample data is synthetic. (CONTRACT §sec.live-data)
- Matt's logo kit artifact (Consolidate mark, horizontal lockup, Thinking wave).
- No testimonials, users or metrics exist beyond Matt; none may be invented.

## Product Principles

1. The loop first: a screen earns its place by moving notes into practice, errors into weak spots, or weak spots into today's plan.
2. His thinking stays his: E.V. proposes, cites and checks; Matt attempts, decides and keeps.
3. Calm over clever: one voice, one accent, one question, no decoration that asks for attention.
4. Everything he owns, he can make, change and undo where it lives.

## Accessibility & Inclusion

Text meets 4.5:1 contrast in both themes, and one reduced-motion setting zeroes every duration. (CONTRACT §ui.access)
