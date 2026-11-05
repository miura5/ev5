## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next). Rehearsal 2 (B-758) and the scratch-copy check (B-732) are declined (D-484).
## Running    nothing. Run 86 merged B-1003, B-961, B-1002, B-1032 and B-1004 part 1 (#538 to #543). The hourly routine is off; a separate thread runs the ev4 and subject-code removal sweep (B-900 to B-906, B-1011 removals) and files its own Chart edits.
Builders use their own git worktree; never commit node_modules. Run lock: ops/build-lock.sh.
Local `npm test` fails on directory entries in this sandbox (environmental): run the other checks by hand, CI judges. Do not import data/compat from Worker-side data code.
The sandbox cannot reach developers.cloudflare.com: B-1025 Wrangler facts came from memory (staging run 461 green; live.yml unproven).
## Waiting on Matt   nothing
## Next       Order agreed with Matt 2026-11-05 (D-489, amended by D-495; do not drop it). When you rewrite this, keep the groups and their order: drop done tasks, put new tasks in their group. Work the groups in order; inside a group, in the order listed.
(1) Audit fixes: done (run 82).
(2) Record drift: done (run 83; B-1023 run 84).
(3) Kit drift: B-970, B-971, B-972, B-974, B-975, B-976, B-977, B-978 and B-1031 are merged (several not yet seen on staging). 
B-1021 (baselines commit leaves a PR blocked at action_required) has a fix merged but is unproven: check on the next kit PR with baselines. 
Open: B-942 (Today/Progress vs mock-up; Courses in the sidebar and course dots are not in the mock-up: design agent updates it or the bar drops them), B-973 (with B-940; its branch is empty), B-1046 (one toast host), B-1047 (one note renderer), B-1032 (not yet checked against the mock-up in a browser), then B-979, with Back B-1012 and B-1013.
(4) Data layer. First B-1035, the table design (a doc the build manager reviews, then a decision, before any follow-on). It blocks B-1022, B-1004, B-1033, B-1034 and B-1003 (recheck); B-998 is reopened as its one migration.
Then B-1036's docs-kind check (its other checks land with the tasks that clear their traces), B-1022 (new row shapes), B-998 (migration).
Moves: B-1037 attempts, B-1038 goals and objectives with link rows, B-1039 weak spots, B-1040 sets, B-1041 sessions, B-1042 notes, B-1043 talk (Ask E.V. keeps its chat), B-1004/B-1033/B-1034 plans; then B-1044 (due read on attempts), B-1045 (note pictures).
Then the rest of B-955, B-1001, B-1005 (read current Anthropic docs first; this sandbox cannot), B-1009. Bugs alongside, in folders the current task does not write: B-1048, B-1049, B-1050. B-1006, B-1007, B-1008, B-1011 wait for group 3. Small follow-up: pass onBad to the table repos.
(5) Cutover steps: B-822 (staging proof, Mac copy), B-754 (morning, evening, weekly_review job kinds), B-757 (drills on the new tables), B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029, B-1030. B-755 (Canvas) is now optional after cutover (D-495).
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1014 to B-1016, B-803 and B-808 (one staging check each; B-803 needs ANTHROPIC_API_KEY), B-943 on staging, Library practice session and Edit/Study hookups, B-749, B-750, weeklyreview.done and set.write_with_ev (501).
Not in this order: the after-cutover milestone (D-480, D-487); B-965 is Matt's choice after cutover, never build it without his word.
## Staging    ev5-staging, deploys on push to main. The shell shows a token screen first (paste once; stored as localStorage `ev5.token`). To try: Today, Library, Activity, Recently deleted, the theme button at the sidebar foot.   ## Live  ev4 build (unchanged)
