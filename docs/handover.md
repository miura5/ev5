## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next).
## Running    nothing. (Node 22 sandbox: `node --test <dir>` fails there; CI is the proof.)
NOTE: B-1049 grading is untried on staging with a real model call. Fix live.yml's D1 lookup before the live database is made (B-823 notes).
## Waiting on Matt   nothing (to batch later: R2 key secrets for the drill's picture check, B-1045)
## Next       Order agreed with Matt 2026-11-05 (D-489, amended by D-495; do not drop it). Keep groups and order; drop done tasks.
Task freeze (D-497): no new task ids until groups 3 to 6 are done; findings go in task notes or docs/parked.md.
(3) Kit drift: B-1012 left: its e2e journey's first staging run, seen on staging. B-942 left: light theme/PNG check on staging. B-979 waits on B-974, B-975 and two kit-class overrides in areas/ (notes); not built.
(4) Data layer, built to D-498 (wins over docs/proposals/table-design.md; replaces D-496).
Order: B-1022 remainder (WireDoc in areas, old doc-row shapes after B-1037 to B-1043, plan row shape so jobs drop PlanSchema, contract migration dropping target_c),
B-998 remainder (notes and plan items on memberships.save need their tables; item_props to plan_items columns; item.move/pin on old repos; part 2 ONLY after every docs reader and writer has moved: remove /docs routes and data/docs, contract migration with the next free number, 0018 (D-506), rerun drill),
B-1036 (checks 1, 2 second half, 6, 7 wait for the docs removal).
Done 2026-11-07 (#695 to #697: workflow permissions B-1036 b; prep-plan e2e rename and planeditDocs gone B-1004; jobs use domain PlanBody B-1022; #689, #691 to #693): WireDoc in domain; jobs/study-plan renamed prep-plan (B-1004); drill checks pictures when R2 keys are set (B-1045); react-hooks lint on, backfill-migration test (B-1036).
Earlier 11-06 (#671-#688): plan commands, outbox answers and notes as commands, study reads set tables only, files table, Ask tells. Left per task is in the Chart notes.
Next builders: B-1036 (e) Worker size check and (a) action pins (the cloud session could not reach developers.cloudflare.com or resolve action hashes: see notes; may need network access, else skip); B-1004 Library exam planId; B-1037 check.answer UI (needs a mock-up/kit piece first, may wait), B-1040 own_* retire list, B-1044, B-1038 B8. Then the squash.
Then the rest of B-955, B-1001, B-1005 (read current Anthropic docs first; slice jobs/runtime). B-1006 to B-1008 wait for group 3. Follow-up: pass onBad to the table repos.
Small ev4-trace cleanups: B-1059 (after B-1009); B-1060 left: mockup-audit.md, canonical.samples.json, kit baselines (notes).
(5) Cutover steps: B-822, B-754, B-757, B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029.
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1015, B-1016, B-803 and B-808 (B-803 needs ANTHROPIC_API_KEY), Library practice and Edit/Study hookups, weeklyreview.done, set.write_with_ev (501). Sweep thread (B-900 to B-906) files its own Chart edits.
Not in this order: feature ideas (Matt's list outside the repo, D-512).
## Staging    ev5-staging, deploys on push to main; rebuilt from empty 2026-11-06 (staging workflow, rebuild=true). Token screen first (paste once; localStorage `ev5.token`). To try: Today, Library (Dates tab: a date's Kind; Plan with E.V. on the exam), Activity, the sidebar-foot theme button.   ## Live  ev4 build (unchanged)
