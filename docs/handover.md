## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next).
## Running    nothing (run 1718Z: #875, #876, #877, #878, #880 merged; staging rebuilt from empty 17:50Z on the new baseline).
NOTE B-1036 (a) action pins, (e) size check blocked: sandbox cannot reach other repos or Cloudflare docs.
## Waiting on Matt   nothing (to batch later: R2 key secrets for the drill's picture check, B-1045)
## Next       Order agreed with Matt 2026-11-05 (D-489, D-495). Keep groups and order. No new task ids until groups 3 to 6 are done (D-497): findings go in task notes or docs/parked.md.
(3) Kit drift: lane B (docs/handover-b.md, D-530).
(4) Data layer, built to D-498 (wins over docs/proposals/table-design.md). No contract migration: after B-998 part 2 one squash baseline replaces the chain (D-514).
Order: B-1022 remainder (row routes for item versions and session events; plan-home raw SQL in server/; F9, KISS 10, sourceRef, attempts rule done),
B-998 remainder ((d) squash and was_due done #877 #880. Left: rerun the restore drill, no workflow for it, needs Cloudflare),
B-955 left: merge the two gates (docs gate vs data/tables/gate.ts; docs table is gone now, so do it). B-1001 left: raw SQL and bare ids in routes (date.create done #878),
B-1036 left: checks 1 (needs sata→multi_select, matrix→grid rename first), 2 (docs table gone: do it now), 3, 4; knip ignore: domain/session, own-set, collection nesting (§data.membership: decide), note, ceiling, reportJob (Mac), modelsStaleWarning (wire or delete). B-1005 done (#865).
B-1044 and B-1038 B8: was_due is in the baseline (#880); they need B-1037's attempts reader.
B-980 left: one staging run of a failing job. B-1045: R2 keys (Matt) left.
Ask Matt later: should a self-rated 'again' count as a miss (now no). Then the squash. Builders: one git worktree each, npm ci first; Interface trailer on the commit touching an interface.
Then rest of B-955, B-1001, B-1005. B-1006 to B-1008 moved to lane B (after B-1001).
Small ev4-trace cleanups: B-1059 (after B-1009).
(5) Cutover steps: B-822, B-754, B-757, B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029.
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-982 (your 9 data, jobs and server test files; lane B does the rest, see notes), B-987 and B-1015 (split, lane B parts to docs/handover-b.md, see notes), B-808 (needs ANTHROPIC_API_KEY), Library practice and Edit/Study hookups, weeklyreview.done, set.write_with_ev (501). B-803's code parts and B-956 moved to lane B.
Not in this order: feature ideas (Matt's list outside the repo, D-512).
## Staging    ev5-staging, deploys on push to main; rebuilt from empty 2026-11-06. Token screen first (paste once; localStorage `ev5.token`). To try: Today, Library (Dates tab: a date's Kind; Plan with E.V. on the exam), Activity, the sidebar-foot theme button; Recently deleted (goals, sets, sessions show right labels).   ## Live  ev4 build (unchanged)
