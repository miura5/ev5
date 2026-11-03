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

`.github/workflows/rehearsal.yml` (dispatch only; staging token). Throwaway Worker and D1 named `ev5-rehearsal`; `cleanup` deletes both. It checks out ev4 at `ev4_ref`, rewrites ev4's wrangler config to the throwaway names (dropping routes, cron triggers and R2 buckets, and refusing to go on if any remain), then:

1. deploys ev4 with the synthetic record and a random throwaway bearer token;
2. deploys empty v5 over it with a `PlanJob` stub (so the class is never removed);
3. `verify.sh v5-gone`: every route in `data/compat/routes.json` answers 410;
4. rolls back (stand-in for steps 2 and 3 above: nothing to drain, ev4's build redeployed from the same config);
5. `verify.sh ev4-up`, and the `PlanJob` binding is still present on the Worker.

Inputs: `ev4_ref`, `ev4_token_secret` (the Worker secret name ev4 reads its token from), and optionally `ev4_config` and `ev4_schema` (default `pwa/wrangler.toml`, `pwa/schema.sql`). `REHEARSAL_COLLECTION` and `REHEARSAL_BODY` set the document the write probe uses (default `ideas`).

### Not yet runnable (missing, not invented)

- **ev4's build.** The ev4 repository is not in v5's builder scope. The workflow needs a repository secret `EV4_CHECKOUT_TOKEN` (read access to ev4, Matt's to create: §who.matt) and ev4 a commit or tag to rehearse. The ev4 config path, schema path, bearer-secret name and wrangler layout above are assumptions to confirm on the first dispatch; only `data/compat` (routes, schemas, `SOURCE.md`) is known here.
- **ev4's synthetic record.** Only v5's `data/staging` seed is available; ev4's own fixtures live in its repository. The first dispatch loads ev4's schema plus that seed.
- **v5 answering 410.** `server/index.ts` answers unknown `/api/*` with 404 and does not yet keep a `PlanJob` class or binding in `wrangler.jsonc`. Step 3 will fail until the Worker returns 410 for ev4's routes (§data.ev4-routes); the rehearsal supplies its own `PlanJob` stub, but the real v5 build must keep one.
- **PlanJob state and IndexedDB.** The workflow checks only that the binding survives. Stored `PlanJob` state needs an ev4 probe route (unknown here), and ev4's IndexedDB lives in the browser, so Matt checks it in step 5.
- **Drain commands** are the documented wrangler ones, untried here; rehearsal 2 exercises them with real Workflows.
- A workflow can be dispatched only once it is on main.
