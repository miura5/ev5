## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next).
## Running    nothing. (Node 22 sandbox: CI is the proof.)
NOTE: deletions made before #580 show twice in Recently deleted (B-1040). B-1049 grading is untried on staging with a real model call.
Scope sweep 2026-11-06 done (#614 to #621): rules, docs, mock-up and code say any learner; dates have a kind (Exam or Other, D-505); stored names renamed (prep_plan, plan.*, goalId, full_run; migrations 0015, 0016). What is left is in the Chart notes (B-1004, B-1036, B-1038, B-1039, B-1060) and docs/parked.md.
## Waiting on Matt   nothing
## Next       Order agreed with Matt 2026-11-05 (D-489, amended by D-495; do not drop it). On rewrite keep groups and order: drop done tasks, put new ones in their group. Work groups in order.
Task freeze (D-497): no new task ids until groups 3 to 6 are done; findings go in task notes or docs/parked.md.
(3) Kit drift: most merged.
Open: B-942 (left: Today/Progress vs mock-up, pinned collections show their next date, no Courses; see notes), B-973 (with B-940; its branch is empty), then B-979, with Back B-1012 and B-1013.
(4) Data layer. Build to D-498 (the build manager's decision on docs/proposals/table-design.md; its changes win over the doc and replace D-496).
Order: B-1022 remainder (WireDoc in areas, old doc-row shapes after B-1037 to B-1043, plan row shape so jobs drop PlanSchema, contract migration dropping target_c),
B-998 remainder (notes and plan items on memberships.save need their tables first; item_props to plan_items columns; item.move/pin on old repos; then part 2: remove /docs routes and data/docs, migration, reseed staging, rerun drill),
B-1036 (checks 2 first half, 3, 4, 5, 8, 9 and compat-import done; 1, 2 second half, 6, 7 wait for the docs removal; red fixture PRs left).
Check: migration 0011 (#603) assumes date docs carry `objectives`; test it on a real staging date.
Moves: B-1037 (left: E.V. docs sets, check.answer, ask.just_tell_me, drop own_attempts),
B-1038 (left: exams docs into goals, drop dateedits/examedits and examDocs merge; its claim is from an old run),
B-1040 sets (rest in Chart), B-1043 talk (Ask E.V. keeps its chat), B-1004/B-1033/B-1034 plans; then B-1044 (due read on attempts), B-1045 (note pictures). Builders get own git worktrees.
Then the rest of B-955, B-1001, B-1005 (read current Anthropic docs first), B-1009. B-1006 to B-1008 wait for group 3. Follow-up: pass onBad to the table repos.
Small ev4-trace cleanups (group 4): B-1059 (after B-1009), B-1060 (kit stories and tests, with B-942), B-1061 (spec paths left).
(5) Cutover steps: B-822 (staging proof, Mac copy), B-754 (morning, evening, weekly_review job kinds), B-757 (drills on the new tables), B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029. B-755 (Canvas) is optional after cutover (D-495).
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1015, B-1016, B-803 and B-808 (B-803 needs ANTHROPIC_API_KEY), Library practice session and Edit/Study hookups, weeklyreview.done, set.write_with_ev (501). Sweep thread (B-900 to B-906) files its own Chart edits.
Not in this order: the after-cutover milestone (D-480, D-487); B-965 only on Matt's word after cutover.
## Staging    ev5-staging, deploys on push to main. The shell shows a token screen first (paste once; stored as localStorage `ev5.token`). To try: Today, Library (Dates tab: pick a date's Kind), Activity, Recently deleted, the theme button at the sidebar foot.   ## Live  ev4 build (unchanged)
