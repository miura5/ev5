## Phase      0 · gate items 5 / 6 (S-04, S-05, S-06, S-08 done; Matt's yes on the hard limits, D-451; S-07 part 2 open)
## Running    nothing
## Waiting on Matt   nothing
## Next       S-07 part 2 (B-697), then record Gate 0 (B-700) and start Phase 1 (S-10 onward)
## Staging    none yet   ## Live  ev4 build (unchanged)

### How S-07 part 2 runs
- Cloudflare credentials live only in GitHub, so deploys run in GitHub Actions, never from the cloud session. Add a `workflow_dispatch` workflow `.github/workflows/spike.yml` through a PR. It uses `CLOUDFLARE_API_TOKEN_STAGING` and `CLOUDFLARE_ACCOUNT_ID` and deploys only a Worker and D1 both named `ev5-spike` (never ev-live or its D1, CONTRACT §sec.account). Dispatch it with `gh workflow run` and read its logs.
- Tests: the four in `docs/spikes/S-07-workflows.md` part 2. Write the results into that report.
- When done, delete `ev5-spike` (Worker and D1) through the same workflow (CONTRACT §deliver.cleanup).
- If the CPU-per-step test fails on Free, ask Matt under C5 (CONTRACT §hard.money) through the "For Matt" issue, and carry on with Phase 1.

### Notes for the next run
- Matt's answers ahead of time: hourly runs (D-452); the S-53 scratch-copy OK is given (D-453); Canvas sync stays on the Mac (D-454), and S-81 needs him present.
- `main` is protected: a PR from a `claude/` branch with the `checks` job green, up to date with `main` (`gh pr update-branch` when it shows BEHIND), auto-merge squash.
- Record commits after the squash merge: the squash hash differs from the branch hash.
- Hard limits are CONTRACT §1 (five). The Chart holds decisions D-426…D-451 and seed tasks B-691…B-763 (`docs/record/`).
