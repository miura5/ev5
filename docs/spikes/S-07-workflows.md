# S-07 · Spike: Cloudflare Workflows on the current plan tier

**Status:** part 1 of 2 (limits from current docs). Part 2, the deploy tests, needs real deploys to a throwaway Worker. Those aren't allowed in the interactive setup session, so it runs when deploys are allowed (see the handover).

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

## Recommendation (part 1)
Workflows stays the plan on Free, pending test 4. If test 4 fails, the choice goes to Matt under C5 (move to Paid), because the fallback (a Durable Object alarm) has the same CPU limit on Free.
