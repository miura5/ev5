# Rollback runbook

Takes live from v5 back to the last ev4 build. Rules: §deliver.window, §hard.live-on-matts-word, §hard.data-never-lost, §hard.ev4-own-process, §data.ev4-routes.

Run it only on Matt's word, inside the rollback window, and through the approval-gated `live` environment. Nothing is deleted: v5's additive tables and `deletions` rows stay in D1 and ev4 ignores them (ev4 will show items v5 deleted, and cannot see v5-only things; going forward again, v5 re-derives its own state).

## Before the window opens (cutover)

Record these where the runbook can find them (the Chart, not a file with secrets):
- the git tag of the last ev4 live build, and the ev4 workflow that deploys a tag;
- the Time Travel bookmark taken at cutover;
- the list of ev4 cloud and Mac tasks that were disabled or re-created.

## Steps

1. **Stop and note.** Take a Time Travel bookmark of live D1 now (`wrangler d1 time-travel info`), and run an R2 export. Tell Matt which device writes are in flight (v5 queues only note saves and practice answers offline; they sync after the rollback or stay in v5's IndexedDB).
2. **Drain jobs.** List running Workflow instances (`wrangler workflows instances list <workflow>`). Let short ones finish; terminate the rest (`wrangler workflows instances terminate <workflow> <id>`). A job waiting on Matt stays as its D1 state and is simply not continued. A `PlanJob` run in progress is left to finish or fail: the class stays deployed. Confirm no instance is running before step 3.
3. **Deploy ev4.** Run ev4's own deploy workflow on the recorded tag (never from v5's build). The redeploy drops v5's bindings (Workflows, derived search database, assets) and keeps the `PlanJob` binding and class; v5 never ships a Durable Object deletion, so the redeploy needs no migration.
4. **Re-enable ev4's tasks.** Turn ev4's cloud tasks back on; re-create the Mac tasks with Matt present (§who.matt).
5. **Verify.** With the Worker URL and ev4's bearer token (from the environment, never a file): `bash ops/rollback/verify.sh ev4-up <url> <token>` (boots, reads, writes a document). Then Matt opens ev4 on his devices: his ev4 IndexedDB (`ev-app`) is untouched, because v5 uses another database name (§data.offline). Check `PlanJob` is still bound and answers.
6. **Record.** Write the rollback and its reason to the Chart; the window stays open until Matt closes it.

Going forward again is a normal v5 deploy through the `live` environment on Matt's word (rehearsal 2).

## Rehearsal 1

`.github/workflows/rehearsal.yml` (dispatch only; staging token). Throwaway Worker and D1 named `ev5-rehearsal`; `cleanup` deletes both. It clones the public ev4 repository over https at `ev4_ref` (no token), builds its page (`npm run build` in `pwa/`), rewrites `pwa/wrangler.toml` to a `pwa/rehearsal.toml` with the throwaway names (dropping comments, every `[env.*]` table, routes, cron triggers and R2 buckets, and refusing to go on if any ev4 name or resource remains), then:

1. deploys ev4 with its own made-up record (`node pwa/seed.mjs --append`) and a random throwaway bearer token, set as the Worker secret `EV_TOKEN`;
2. deploys v5's real Worker entry (`server/worker.ts`, which exports the `PlanJob` stub, so the class is never removed) over it, under the throwaway names only;
3. `verify.sh v5-gone`: every route in `data/compat/routes.json` answers 410;
4. rolls back (stand-in for steps 2 and 3 above: nothing to drain, ev4's build redeployed from the same config);
5. `verify.sh ev4-up`, and the `PlanJob` binding is still present on the Worker.

Inputs: `ev4_ref` (required), and optionally `ev4_token_secret` (default `EV_TOKEN`, what `pwa/worker.js` reads), `ev4_config` (default `pwa/wrangler.toml`) and `ev4_schema` (default `pwa/schema.sql`); the defaults are checked against ev4. `REHEARSAL_COLLECTION` and `REHEARSAL_BODY` set the document the write probe uses (default `ideas`).

### Not yet runnable (missing, not invented)

- **ev4's build.** Resolved: ev4 is public, so the workflow needs no token. It needs a commit or tag of ev4 to rehearse (the last live build's tag, `ev4_ref`). Still unconfirmed until the first dispatch: that ev4's build runs on the CI runner (`npm ci`, then `npm run build` in `pwa/`) and that its config survives the rewrite.
- **ev4's synthetic record.** ev4's own generator (`pwa/seed.mjs`) supplies it; v5's `data/staging` seed is not used.
- **v5 answering 410.** `server/index.ts` answers ev4's routes with 410 (`server/ev4-routes.ts`, §data.ev4-routes), and `server/worker.ts` exports the `PlanJob` stub that `wrangler.jsonc` binds as `PLAN_JOBS` with migration `v1-plan-jobs`. Step 2 deploys that real entry, so step 3 tests the build as it ships; the first dispatch still has to confirm it.
- **PlanJob state and IndexedDB.** The workflow checks only that the binding survives. Stored `PlanJob` state needs an ev4 probe route (unknown here), and ev4's IndexedDB lives in the browser, so Matt checks it in step 5.
- **Drain commands** are the documented wrangler ones, untried here; rehearsal 2 exercises them with real Workflows.
- A workflow can be dispatched only once it is on main.
