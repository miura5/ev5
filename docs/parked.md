# Parked findings

Findings from runs, reviews and audits (bugs, fixes and cleanups) that fit no open task while the task freeze holds (see the handover's Next). One line each, no task or decision ids. Feature ideas go to Matt's feature list instead (AGENTS.md §5). The build manager files them as tasks after the freeze ends.

- Recently deleted shows a collection deleted before migration 0010 twice: the old-id copy reads Untitled and answers 404 on Restore. Gone on staging after the rebuild; live starts empty.
- A guard so only numbered `.sql` files land in `data/migrations`: wrangler applies every `.sql` there, and `ev4-schema.fixture.sql` is recorded as applied on staging (harmless today).
- The Library's graded-answer screen is drawn in the view (`areas/library/Study.view.tsx`), outside the kit's study card, and the mock-up lacks it: move it into the kit with a mock-up screen.
- Pages reflow at 200% browser zoom: every screen reads and works with no sideways scroll (§ui.access).
- The record render: show a decision's amends both ways (a decision that is amended names what amends it), so a reader of an older decision finds the newer one.
- AGENTS.md §4.3 S-49 and S-50 still describe ev4 shapes (D1 repositories over `docs`, the migration baseline); reword them when AGENTS.md changes are next approved.
- Install guards: `.npmrc` blocks install scripts except a named list, plus a minimum release age if the CI npm version supports it (check first). For the checks task (ev4 traces).
- Short test output: a Vitest setup that limits Testing Library's DOM dump on failure. For the checks task (ev4 traces).
- Dependency alerts: GitHub security alerts on, with no bot PRs (§deliver.main). A repo setting Matt turns on; for the cutover checklist.
- e2e failure evidence: the gate configs keep a screenshot and the console errors when a journey fails; trace stays off because it would record the staging token in a public repo. For the e2e-through-commands task.
- Search excerpt: `domain/search/index.ts` cuts a passage to its first 700 characters, so a late match can fall out; cut around the match, with a retrieval test. For the notes and collections typed-rows task, beside its search note.
- ⌘K found list: the mock-up finds sets, notes, dates, plan items, weak spots, collections and saved views by name, while `shell/findings.ts` finds only notes, dates, sets and weak spots; ⌘K also finds collections, plan items and saved views (§ui.mockup, §ui.palette). For the task that moves `shell/findings.ts` off documents (weak spots to rows).
- One picture loader: `areas/sessions/Picture.tsx` fetches on every mount and never revokes its blob URL; use the cached loader in `notePictures.ts`. For the note pictures task.
- Toast pause: the kit Toast hides after 4 s even under the pointer; pause on hover and focus, keep 4 s, no new dependency. For the screens-draw-no-rows check task (kit drift).
- Note links in the read view open in the same tab: add `target=_blank` and `rel=noopener noreferrer` on the link in `kit/components/NoteBlocks/NoteBlocks.tsx`. No security issue, since note links already allow only http(s). Polish, after cutover.
