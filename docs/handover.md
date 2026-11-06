## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next). B-758 and B-732 declined (D-484).
## Running    nothing. Run 91 merged: B-1039 reads (#571: weak spots read from the tables; staging shows none until creation exists), B-1036 cleanups (#570). Run 90 merged: B-998 1b (tables gate, #563) and 1c (migration 0007: plans, plan_items, repeats, drafts.target_kind, #566), B-1022 slice 3 (drafts row, #564), B-1036 checks 3, 4, 5, 8, 9 (#565, #568), B-1039 slice 1 (#567).
Sandbox runs Node 22 (repo wants 26): precheck fails locally on directory tests; CI is the proof.
NOTE B-1039: reads now come from the tables; nothing creates weak spots there yet (creation is the next B-1039 piece).
## Waiting on Matt   nothing
## Next       Order agreed with Matt 2026-11-05 (D-489, amended by D-495; do not drop it). On rewrite keep groups and order: drop done tasks, put new ones in their group. Work groups in order.
Task freeze (D-497): no new task ids until groups 3 to 6 are done; findings go in task notes or docs/parked.md.
(1) Audit fixes: done (run 82).
(2) Record drift: done (run 83; B-1023 run 84).
(3) Kit drift: most merged. B-1021 (baselines commit leaves a PR blocked at action_required) fix unproven: check on the next kit PR with baselines.
Open: B-942 (Today/Progress vs mock-up; Courses in the sidebar and course dots are not in the mock-up: design agent updates it or the bar drops them), B-973 (with B-940; its branch is empty), B-1032 (not yet checked against the mock-up in a browser), then B-979, with Back B-1012 and B-1013.
(4) Data layer. Build to D-498 (the build manager's decision on docs/proposals/table-design.md; its changes win over the doc and replace D-496).
Order: B-1039 creation (weak spots into the tables), then B-1022 remainder (callers off old shapes and fill drafts.target_kind; job and hold id prefixes; WireDoc in areas; model_usage not needed), B-998 remainder (plan repository, other repos onto the gate, export WriteRefused and 4xx map, export parseDraftTableRow; part 2: remove /docs routes and data/docs, migration 0008, reseed staging, rerun drill), B-1036 (check 2 second half; 1, 6, 7 wait for the sweep).
Moves: B-1037 attempts, B-1038 goals and objectives with link rows, B-1039 reads, B-1040 sets, B-1041 sessions, B-1042 notes, B-1043 talk (Ask E.V. keeps its chat), B-1004/B-1033/B-1034 plans; then B-1044 (due read on attempts), B-1045 (note pictures).
Then the rest of B-955, B-1001, B-1005 (read current Anthropic docs first; this sandbox cannot), B-1009. Bugs alongside, in folders the current task does not write: B-1048, B-1049, B-1050. B-1006, B-1007, B-1008, B-1011 wait for group 3. Small follow-up: pass onBad to the table repos.
Small ev4-trace cleanups (group 4): B-1059 (journeys, after B-1009), B-1060 (sample content, with B-942), B-1061 (Chart triage), B-1062 (PLAN and AGENTS lines; Matt approved the AGENTS part, ev4 and one-subject lines only, D-497).
(5) Cutover steps: B-822 (staging proof, Mac copy), B-754 (morning, evening, weekly_review job kinds), B-757 (drills on the new tables), B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029, B-1030. B-755 (Canvas) is now optional after cutover (D-495).
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1014 to B-1016, B-803 and B-808 (B-803 needs ANTHROPIC_API_KEY), B-943, Library practice session and Edit/Study hookups, B-749, B-750, weeklyreview.done, set.write_with_ev (501). Sweep thread (B-900 to B-906) files its own Chart edits.
Not in this order: the after-cutover milestone (D-480, D-487); B-965 only on Matt's word after cutover.
## Staging    ev5-staging, deploys on push to main. The shell shows a token screen first (paste once; stored as localStorage `ev5.token`). To try: Today, Library, Activity, Recently deleted, the theme button at the sidebar foot.   ## Live  ev4 build (unchanged)
