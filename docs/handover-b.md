## Phase      6 · lane B (AGENTS.md §3 "Two lanes"): kit, areas, shell and tooling tasks whose slice avoids data/, domain/, server/, jobs/ and commands/.
## Running    nothing.
## Waiting on Matt   nothing
## Next       Lane B's order, set by the supervisor 2026-11-07 (D-530). Keep the order; drop done tasks.
(1) Code merged, done bar needs staging: B-985 (Menu and ⌘K follow the picked theme, both themes), B-974 (Recently deleted on kit parts), B-975 (Activity on kit parts), B-942 (Today and Progress in the light theme against the mock-up), B-986 (a new build reaches the open app with no hard reload). Each needs a look at staging in a browser with the staging token; if this run can't open staging, list them in the PR for the supervisor's playtest and go on.
(2) Build: B-1060 left (kit baselines in Docker through the visual-baselines workflow; claimed by another run, check first). B-958 (#860) and B-940 (#858) are merged or merging: B-958 needs only a check that main's CI is green; B-940 needs a look on staging (note page menu has Pin, Move, Delete and no Open; By-collection rows show the menu).
(3) After B-974 and B-975 are done: B-979 (guards so screens draw rows, heads, sections and empty states only with the kit; two kit-class overrides in areas/ first, see its notes).
(4) After lane A lands B-982: B-983 (one Vitest setup with cleanup, flakes gone), then B-991 (⌘K ranks Places and Commands with cmdk's filter).
For lane A: B-940 Pin never shows Unpin on Notes rows: Notes needs the pinned flag (item.pin/item.unpin exist); a data/commands change.
## Staging    see docs/handover.md.   ## Live  ev4 build (unchanged)
