# Parked findings

Findings from runs, reviews and audits (bugs, fixes and cleanups) that fit no open task while the task freeze holds (see the handover's Next). One line each, no task or decision ids. Feature ideas go to Matt's feature list instead (AGENTS.md §5). The build manager files them as tasks after the freeze ends.

- Recently deleted shows a collection deleted before migration 0010 twice: the old-id copy reads Untitled and answers 404 on Restore. Gone on staging after the rebuild; live starts empty.
- A guard so only numbered `.sql` files land in `data/migrations`: wrangler applies every `.sql` there, and `ev4-schema.fixture.sql` is recorded as applied on staging (harmless today).
- The Library's graded-answer screen is drawn in the view (`areas/library/Study.view.tsx`), outside the kit's study card, and the mock-up lacks it: move it into the kit with a mock-up screen.
- Pages reflow at 200% browser zoom: every screen reads and works with no sideways scroll (§ui.access).
- The record render: show a decision's amends both ways (a decision that is amended names what amends it), so a reader of an older decision finds the newer one.
- AGENTS.md §4.3 S-49 and S-50 still describe ev4 shapes (D1 repositories over `docs`, the migration baseline); reword them when AGENTS.md changes are next approved.
