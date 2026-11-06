## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next).
## Running    nothing. (Node 22 sandbox: CI is the proof.)
NOTE: deletions made before #580 show twice in Recently deleted (B-1040). B-1049 grading is untried on staging with a real model call.
## Waiting on Matt   nothing
## Next       Order agreed with Matt 2026-11-05 (D-489, amended by D-495; do not drop it). On rewrite keep groups and order: drop done tasks, put new ones in their group. Work groups in order.
Task freeze (D-497): no new task ids until groups 3 to 6 are done; findings go in task notes or docs/parked.md.
FIRST: node ops/record/cli.ts inbox file (the Dates decision; supervisor PR #607 edits the inbox and adds 2 more, merge it first), then put the D- ids in B-1038's notes.
(2) Record drift: done (run 83; B-1023 run 84).
(3) Kit drift: most merged.
Open: B-942 (run 94 #589 done: study line, week labels, light bars; left: Today/Progress vs mock-up; Courses in the sidebar and course dots are not in the mock-up: design agent updates it or the bar drops them), B-973 (with B-940; its branch is empty), then B-979, with Back B-1012 and B-1013.
(4) Data layer. Build to D-498 (the build manager's decision on docs/proposals/table-design.md; its changes win over the doc and replace D-496).
Order: B-1022 remainder (drafts, job reads, jobPlans.get #594 done; left: WireDoc in areas, old doc-row shapes after B-1037 to B-1043, plan row shape so jobs drop PlanSchema, contract migration dropping target_c),
B-998 remainder (data #592 and server #595 steps done. Left: notes and plan items on memberships.save need their tables first; item_props to plan_items columns; item.move/pin on old repos; then part 2: remove /docs routes and data/docs, migration, reseed staging, rerun drill),
B-1036 (checks 2 first half, 3, 4, 5, 8, 9 and compat-import done, #596; 1, 2 second half, 6, 7 wait for the docs removal; red fixture PRs left).
Check: migration 0011 (#603) assumes date docs carry `objectives`; test it on a real staging date.
Moves (run 97 done: B-1041 #608, B-1042 #611, B-1039 #610, Dates tab #606; gaps in Chart notes): B-1037 (left: E.V. docs sets, check.answer, ask.just_tell_me, drop own_attempts),
B-1038 (left: exams docs into goals, drop dateedits/examedits and examDocs merge; nothing asks the date-kind registry yet),
B-1040 sets (rest in Chart), B-1043 talk (Ask E.V. keeps its chat), B-1004/B-1033/B-1034 plans; then B-1044 (due read on attempts), B-1045 (note pictures). Builders get own git worktrees.
Then the rest of B-955, B-1001, B-1005 (read current Anthropic docs first), B-1009. B-1006 to B-1008 wait for group 3. Follow-up: pass onBad to the table repos.
Small ev4-trace cleanups (group 4): B-1059 (after B-1009), B-1060 (with B-942), B-1061, B-1062 (Matt approved the AGENTS part, ev4 and one-subject lines only, D-497).
(5) Cutover steps: B-822 (staging proof, Mac copy), B-754 (morning, evening, weekly_review job kinds), B-757 (drills on the new tables), B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029, B-1030. B-755 (Canvas) is now optional after cutover (D-495).
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1014 to B-1016, B-803 and B-808 (B-803 needs ANTHROPIC_API_KEY), Library practice session and Edit/Study hookups, weeklyreview.done, set.write_with_ev (501). Sweep thread (B-900 to B-906) files its own Chart edits.
Not in this order: the after-cutover milestone (D-480, D-487); B-965 only on Matt's word after cutover.
## Staging    ev5-staging, deploys on push to main. The shell shows a token screen first (paste once; stored as localStorage `ev5.token`). To try: Today, Library, Activity, Recently deleted, the theme button at the sidebar foot.   ## Live  ev4 build (unchanged)
