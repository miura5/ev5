# S-07 · Spike: Cloudflare Workflows on the current plan tier

**Status:** complete. Part 1 from current docs; part 2 run 2026-11-03 through GitHub Actions (`spike.yml`, run 41573826112) on a throwaway `ev5-spike` Worker + D1 on the **Free plan** (the deploy refused `limits.cpu_ms` with "not supported for the Free plan", which confirms the account tier).

## Part 1 · Limits (checked 2026-11-02)
Source: developers.cloudflare.com/workflows/reference/limits/ (last updated Sep 21, 2026) and /d1/reference/time-travel/.

| Limit | Workers Free | Workers Paid | Matters for v5 |
|---|---|---|---|
| Available | yes | yes | |
| CPU time per step | **10 ms** | 30 s (configurable to 5 min) | **Risk:** parsing plus Zod validation of a large structured output in one step may exceed 10 ms. The Claude call itself waits on I/O (wall clock per step is unlimited) |
| Steps per Workflow | 1,024 | 10,000 | fine |
| Step result / event payload | 1 MiB | 1 MiB | fine: steps return ids, never content (PLAN §6.2) |
| State per instance | 100 MB | 1 GB | fine |
| Concurrent instances (waiting ones excluded) | 100 | 50,000 | fine (one user) |
| Executions per day | 100,000, shared with Workers' daily limit | unlimited | fine |
| Subrequests per instance | 50 per request | 10,000 | watch: Claude, D1 and R2 calls per step |
| Completed instance state kept | **3 days** | 30 days | fine: the job record lives in D1, not in the instance |
| D1 Time Travel | **7 days** | 30 days | bears on the rollback window and restores (C5) |

## Part 2 · To run on a throwaway Worker+D1 (not live, not ev4's staging)
1. Needs you as a D1 state: the instance ends, and a continuation instance `jobId:step` finishes it, idempotently.
2. Deploy while an instance runs.
3. Redeploy that removes the Workflow binding, as an ev4 rollback would.
4. Measure CPU per step for a synthetic 32k-token structured output parse plus validation on Free. **Pass** if under 10 ms. Otherwise the recommendation is Paid (C5), or splitting parse and validate across steps.

## Part 2 · Results (run 41573826112)
| # | Test | Result |
|---|---|---|
| 1 | Needs-you ends the instance; a continuation finishes it, idempotently | **Pass.** Instance `n1` ended `needs-you` after its wait timed out. A continuation `n1c` got the event and finished. Starting `n1c` again was refused (`instance.already_exists`). D1 marks written once each (`INSERT OR IGNORE`). |
| 2 | Deploy while an instance runs | **Pass.** `d1` was running (sleep step) during a redeploy and completed afterwards with all its marks. |
| 3 | Redeploy that removes the Workflow binding (an ev4 rollback) | **Pass for the deploy.** Deploy succeeded with only the D1 binding and the Worker kept serving. Not shown: what happens to instance `r1`, which was mid-sleep, because the run ended 10 s after the redeploy. Worth a follow-up in rehearsal 1 (S-17). |
| 4 | CPU per step, parse + validate a large structured output, Free plan | **Pass, 3 of 3.** 185,871 bytes, 160 items, hand-written validation, one step, no CPU error. Caveat: not Zod itself, and the step ran on Cloudflare's native Free limit with no CPU timing printed, so the margin is unknown. Re-test with real Zod parsing in S-64. |

## Recommendation (part 1)
Workflows stays the plan on Free. Test 4 passed, so nothing goes to Matt under C5 now. Re-check CPU with real Zod validation in S-64, and check the mid-sleep instance fate under a binding-removing redeploy in S-17.
