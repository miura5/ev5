## Phase      6 · lane B (AGENTS.md §3 "Two lanes"): kit, areas, shell and tooling tasks whose slice avoids data/, domain/, server/, jobs/ and commands/.
## Running    nothing (run 1835Z: #901 B-1068, #903 B-982 lane B part, #914 B-979 guards merged; B-956 done).
## Waiting on Matt   nothing
## Next       Lane B's order, set by the supervisor 2026-11-07 (D-530). Keep the order; drop done tasks.
(1) Staging looks (B-985, B-942, B-986, B-974, B-975, B-940 are marked done from Matt's checks; B-958 only needs main CI green): nothing left for lane B unless the supervisor asks.
(2) B-1060 left (kit baselines in Docker through the visual-baselines workflow; claimed by another run, check first).
(2b) Studio UI port (D-531; reference files in design/final-reference/): the mock-up task B-1065 (free; check the claim), then the kit port's parts (B-1066: a tokens, b Mark, c Dot Glyph JobLine, d Trend StepMeter Horizon Meter after b, e Toast and keys), then the shell port's free parts (B-1067: a sidebar Pinned, b Detail rename). B-1068 done (#901: 1600 px, JPEG 0.85). Area ports wait: B-1069 after B-1006, B-1070 after B-1007, B-1044, B-1008, B-823.
(3) B-979 left: shell error boundary, palette refusal toast (shell/Shell.tsx), key registry (commands/define.ts is lane A, so the registry part waits for lane A's side); guards part done #914.
(4) B-983 (now free: B-982 lane B part is in), then B-991. B-982 stays open for lane A's part.
(5) B-803: code parts on main; only the staging check is left, waiting on ANTHROPIC_API_KEY.
(6) After lane A lands B-1001: B-1006, B-1007, B-1008 (areas parts only; B-1008 (b) domain/search is lane A's). Lane A splits B-987 and B-1015 and moves their lane B parts here.
For lane A: B-982 part: convert the node:test files in data/, jobs/, server/ (now also server/note-id.test.ts and server/plan-repeat-clash.test.ts), add data/**, jobs/**, server/** to the node project's include in vite.config.ts, delete test:node and make test run test:unit only, recheck the knip entry for ops/record/index.ts. B-940 Pin never shows Unpin on Notes rows: Notes needs the pinned flag (item.pin/item.unpin exist); a data/commands change. B-979: key registry part.
## Staging    see docs/handover.md.   ## Live  ev4 build (unchanged)
