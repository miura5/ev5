## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next).
## Running    nothing.
NOTE B-1036 (a) action pins, (e) size check blocked: sandbox cannot reach other repos' tags or developers.cloudflare.com.
## Waiting on Matt   nothing (to batch later: R2 key secrets for the drill's picture check, B-1045)
## Next       Order agreed with Matt 2026-11-05 (D-489, D-495). Keep groups and order. No new task ids until groups 3 to 6 are done (D-497): findings go in task notes or docs/parked.md.
(3) Kit drift: B-1012 done (gate5-e2e green on staging 2026-11-07). B-942 left: light theme/PNG check on staging. B-979 waits on B-974, B-975 and two kit-class overrides in areas/ (notes); not built.
(4) Data layer, built to D-498 (wins over docs/proposals/table-design.md; replaces D-496). No contract migration: after B-998 part 2 one squash baseline replaces the chain 0000 to 0018 (D-514).
Order: B-1022 remainder (old doc-row shapes after B-1037 to B-1043; row routes for item versions, session events; one shared attempts adapter in domain/answers for library, progress, today),
B-998 remainder (notes and plan items on memberships.save need their tables; plan_items.collection_id column (squash baseline) then placeItem drops memberships; item_props drops with the squash; scan jobs/morning for dayedits users; item.move/pin/unpin on old repos (needs pins id/v/deleted_at/target_kind: squash baseline); part 2 ONLY after every docs reader and writer has moved: remove /docs routes and data/docs, then the squash, staging rebuild, rerun drill),
B-1036 (left: check 2 after the docs removal; checks 3 and 4 done #784).
Blocked: B-1044 and B-1038 B8 need B-1037 attempts reader and a was_due column in the squash baseline. B-1060 left: kit baselines (Docker); check design/mockup.html, DESIGN-BRIEF.md; check design/mockup.html and DESIGN-BRIEF.md (stray biology strings now gone, #787).
Run 1100Z: palette dates/sets/weak spots read row routes (docsHttp /docs fallback and listCollection dropped, #806); collectionOf/placeOf/item.rename read rows; seed isEmpty reads rows. B-1036 checks 1, 6, 9 were already on main. Item-type rename already done.
Run 1150Z (#804): handlers-edit/sets reworded; server/index.ts, vite.config.ts, migrationnames.ts keep TO_REWORD lines until cutover (file names).
Run 1157Z: shell services read rows (#808); item.delete/restore of sets, goals, sessions mark rows deleted and Recently deleted lists their titles (#809, #810, #811). Left: server/doc-routes.ts retires once nothing calls /docs. TO_REWORD in ops/checks/ev4word.ts: reword each file, delete its line.
WireDoc, queueAnswer and the dayedits check entries are already gone. B-1037 check.answer UI (needs kit piece).
Ask Matt later: should a self-rated 'again' count as a miss (now no). Then the squash. Builders: one git worktree each, npm ci first; Interface trailer on the commit touching an interface.
Then rest of B-955, B-1001, B-1005. B-1006 to B-1008 wait for group 3.
Small ev4-trace cleanups: B-1059 (after B-1009); B-1060 (see notes).
(5) Cutover steps: B-822, B-754, B-757, B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029.
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1015, B-803 and B-808 (B-803 needs ANTHROPIC_API_KEY), Library practice and Edit/Study hookups, weeklyreview.done, set.write_with_ev (501).
Not in this order: feature ideas (Matt's list outside the repo, D-512).
## Staging    ev5-staging, deploys on push to main; rebuilt from empty 2026-11-06 (staging workflow, rebuild=true). Token screen first (paste once; localStorage `ev5.token`). To try: Today, Library (Dates tab: a date's Kind; Plan with E.V. on the exam), Activity, the sidebar-foot theme button.   ## Live  ev4 build (unchanged)
