## Phase      6 · Gates 0 to 5 done. Next is D-489's order as amended by D-495 (see Next).
## Running    nothing.
NOTE B-1036 (a) action pins, (e) size check blocked: sandbox cannot reach other repos' tags or developers.cloudflare.com.
## Waiting on Matt   nothing (to batch later: R2 key secrets for the drill's picture check, B-1045)
## Next       Order agreed with Matt 2026-11-05 (D-489, D-495). Keep groups and order. No new task ids until groups 3 to 6 are done (D-497): findings go in task notes or docs/parked.md.
(3) Kit drift: B-1012 left: its e2e journey's first staging run, seen on staging. B-942 left: light theme/PNG check on staging. B-979 waits on B-974, B-975 and two kit-class overrides in areas/ (notes); not built.
(4) Data layer, built to D-498 (wins over docs/proposals/table-design.md; replaces D-496). No contract migration: after B-998 part 2 one squash baseline replaces the chain 0000 to 0018 (D-514).
Order: B-1022 remainder (old doc-row shapes after B-1037 to B-1043; plan_items columns move: commands/plan.command.ts, server/handlers-plan.ts and plan-options.ts placeItem, areas/today, e2e plan-today dayedits read, together),
B-998 remainder (notes and plan items on memberships.save need their tables; item_props to plan_items columns (with the B-1022 move); item.move/pin/unpin on old repos (needs pins id/v/deleted_at/target_kind: squash baseline); part 2 ONLY after every docs reader and writer has moved: remove /docs routes and data/docs, then the squash, staging rebuild, rerun drill),
B-1036 (left: check 1 after the item-type rename sata->multi_select, matrix->grid; check 2 second half after the docs removal; checks 4 to 9 are on main).
Done 2026-11-07 (#723 to #765): row routes for all kinds incl. item versions, session events; Library, Today, plan-home read rows; plan item fields in domain/plan; notes place by notes.collection_id; sessions answer() calls check.answer; e2e uses commands and rows; ev4-word list shorter.
Blocked: B-1044 and B-1038 B8 need B-1037 attempts reader and a was_due column in the squash baseline. B-1060 left: kit baselines (Docker); data/protocol canonical.samples.json sample text (pair with protocol-suite.ts).
Left from B-1037: no open check reaches the session screen (needs a server/commands source for the question); decide whether check.just_tell_me writes an attempts row. data/staging/seed.ts still reads /docs. 
Next builders: B-1022 WireDoc for sets/answers/plans/plan_items in areas/library, row routes for item versions, session events, plan rows; B-1036 (e)/(a) if hosts reachable; B-1037 check.answer UI (needs kit piece); B-1038 other parts. Ask Matt later: should a self-rated 'again' count as a miss (now it does not). Then the squash. Builders: one git worktree each; the Interface trailer must be on the commit that touches an interface (a missing one cannot be fixed without force-push: re-squash to a new branch).
Then the rest of B-955, B-1001, B-1005 (cost/live-docs check). B-1006 to B-1008 wait for group 3. Follow-up: pass onBad to the table repos.
Small ev4-trace cleanups: B-1059 (after B-1009); B-1060 left: mockup-audit.md, canonical.samples.json, kit baselines (notes).
(5) Cutover steps: B-822, B-754, B-757, B-756, B-759, B-823, B-1026, B-1027 (after B-1005), B-1028, B-1029.
(6) Gate 6 B-760.
(7) B-1051: review, then fix bugs, repeated until Matt says the app is right. Only then Phase 7 (B-825, review, UX pass, release card).
Then leftovers, only in folders the current group does not write: B-980, B-982 to B-992, B-1015, B-803 and B-808 (B-803 needs ANTHROPIC_API_KEY), Library practice and Edit/Study hookups, weeklyreview.done, set.write_with_ev (501).
Not in this order: feature ideas (Matt's list outside the repo, D-512).
## Staging    ev5-staging, deploys on push to main; rebuilt from empty 2026-11-06 (staging workflow, rebuild=true). Token screen first (paste once; localStorage `ev5.token`). To try: Today, Library (Dates tab: a date's Kind; Plan with E.V. on the exam), Activity, the sidebar-foot theme button.   ## Live  ev4 build (unchanged)
