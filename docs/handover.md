## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next).
## Running    nothing. (Node 22 sandbox: `node --test <dir>` fails there; CI is the proof.)
NOTE: B-1049 grading is untried on staging with a real model call. Fix live.yml's D1 lookup before the live database is made (B-823 notes).
## Waiting on Matt   nothing
## Next       Order agreed with Matt 2026-11-05 (D-489, amended by D-495; do not drop it). Keep groups and order; drop done tasks.
Task freeze (D-497): no new task ids until groups 3 to 6 are done; findings go in task notes or docs/parked.md.
(3) Kit drift: B-1013 done 2026-11-06 (#644); B-1012 Back/Forward done in code (#645, #650), left: its e2e journey's first staging run and seen on staging. B-942 mostly done (#636; left: light theme/PNG check on staging). B-979 waits on B-974 and B-975 and on two kit-class overrides in areas/ (see its notes); not built.
(4) Data layer. Build to D-498 (the build manager's decision on docs/proposals/table-design.md; its changes win over the doc and replace D-496).
Order: B-1022 remainder (WireDoc in areas, old doc-row shapes after B-1037 to B-1043, plan row shape so jobs drop PlanSchema, contract migration dropping target_c),
B-998 remainder (notes and plan items on memberships.save need their tables first; item_props to plan_items columns; item.move/pin on old repos; then part 2 ONLY after every docs reader and writer has moved, listed in its notes: remove /docs routes and data/docs, the contract migration with the next free number (D-506), rerun drill),
B-1036 (checks 2 first half, 3, 4, 5, 8, 9 and compat-import done; 1, 2 second half, 6, 7 wait for the docs removal; red fixture PRs left).
Moves: B-1037 (left: the outbox's note saves off PUT /docs, E.V. docs sets, check.answer, ask.just_tell_me, one attempts reader for every screen, drop own_attempts; choice cards show options done, #648),
B-1038 (#635 dropped the examDocs merge, dateedits/examedits and date.update's old-date path; left B3 goal-shaped read type then delete domain/exam, which needs areas/ and jobs/ in the slice, and B8; see notes; open, claim freed),
B-1040 sets (collection pages for sets done #649; left: the user's sets not kind adhoc, collection type icons in areas/, rest in Chart), B-1039 weak spots (#643: the weak_spot->goal link is read; left: the weak-spot-links command in commands/, the picker in areas/, B7, F2, F25; D-509), B-1043 talk (Ask E.V. keeps its chat), B-1004/B-1033/B-1034 plans; then B-1044 (due read on attempts), B-1045 (note pictures). Builders get own git worktrees.
Then the rest of B-955, B-1001, B-1005 (read current Anthropic docs first; slice jobs/runtime). B-1006 to B-1008 wait for group 3. Follow-up: pass onBad to the table repos.
Small ev4-trace cleanups (group 4): B-1059 (after B-1009), B-1060 (kit stories and tests, with B-942), B-1061 (the superseded-tasks decision).
(5) Cutover steps: B-822 (staging proof, Mac copy), B-754 (scheduled commands: morning, evening, weekly), B-757 (drills on the new tables), B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029.
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1015, B-1016, B-803 and B-808 (B-803 needs ANTHROPIC_API_KEY), Library practice session and Edit/Study hookups, weeklyreview.done, set.write_with_ev (501). Sweep thread (B-900 to B-906) files its own Chart edits.
Not in this order: feature ideas, which live in Matt's feature list outside the repo (D-512).
## Staging    ev5-staging, deploys on push to main; rebuilt from empty 2026-11-06 (run the staging workflow with rebuild=true to do it again). The shell shows a token screen first (paste once; stored as localStorage `ev5.token`). To try: Today, Library (Dates tab: pick a date's Kind; Plan with E.V. on the exam), Activity, the theme button at the sidebar foot.   ## Live  ev4 build (unchanged)
