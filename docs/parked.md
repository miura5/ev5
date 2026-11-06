# Parked findings

Findings from runs, reviews and audits that fit no open task while the task freeze holds (see the handover's Next). One line each, no task or decision ids. The build manager files them as tasks after the freeze ends.

- Prep plans for date kinds other than exam (a talk, a trip, a renewal): the date-kind registry gives other kinds a prep plan; Matt agreed the direction 2026-11-06.
- A time zone setting: `domain/time` reads the user's time zone from a setting instead of the one constant `ZONE` (America/Chicago today), so scheduled commands and the calendar day follow the user's own zone (§job.schedule).
- Recently deleted shows a collection deleted before migration 0010 twice: the old-id copy reads Untitled and answers 404 on Restore. Gone on staging after the rebuild; live starts empty.
- A guard so only numbered `.sql` files land in `data/migrations`: wrangler applies every `.sql` there, and `ev4-schema.fixture.sql` is recorded as applied on staging (harmless today).
- The Library's graded-answer screen is drawn in the view (`areas/library/Study.view.tsx`), outside the kit's study card, and the mock-up lacks it: move it into the kit with a mock-up screen.
- The record render: show a decision's amends both ways (a decision that is amended names what amends it), so a reader of an older decision finds the newer one.
- AGENTS.md §4.3 S-49 and S-50 still describe ev4 shapes (D1 repositories over `docs`, the migration baseline); reword them when AGENTS.md changes are next approved.
