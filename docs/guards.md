# Guards, and the red they show

`ops/guards/guards.test.ts` proves each guard fails when it should. For every row it builds a temp repo holding the real guard config (copied, never loosened), links `node_modules`, checks the clean repo passes, adds one violation, runs the guard's real command and asserts a non-zero exit and the finding below.

Run: `node --experimental-strip-types --test ops/guards/guards.test.ts` (Node 22; no flag needed on 24+). Add `GUARDS_SHOW=1` to print the red output. The output below was observed on 2026-11-03.

| Violation | Command | Observed red output |
|---|---|---|
| A 301-line file | `eslint . --max-warnings 0` | `301:1  error  File has too many lines (301). Maximum allowed is 300  max-lines` |
| An inline `eslint-disable` | `eslint . --max-warnings 0` | `warning  '// eslint-disable-next-line no-undef' has no effect because you have 'noInlineConfig' setting in your config`, then `ESLint found too many warnings (maximum: 0).` |
| A `@ts-ignore` comment | `eslint . --max-warnings 0` | `error  Unexpected '@ts-ignore' comment: '@ts-ignore'  no-warning-comments` |
| An `export * from` | `eslint . --max-warnings 0` | `error  No \`export *\`: re-export by name (CONTRACT §drift.imports)  no-restricted-syntax` |
| A bad import (`domain` into `data`) | `depcruise areas shell kit commands jobs domain data server ops --config .dependency-cruiser.cjs` | `error domain-imports: domain/bad.ts → data/index.ts` |
| A cycle | same | `error no-cycles: domain/a.ts → domain/b.ts → domain/a.ts` |
| A raw colour | `stylelint "**/*.css" --allow-empty-input` | `Disallowed hex color "#ff0000"  color-no-hex` and `declaration-property-value-allowed-list` |
| An unused export | `knip` | `Unused exports (1)` / `unused  domain/dead.ts:2:14` |
| A component without a story | `node ops/checks/cli.ts --root <repo>` | `presence: kit/components/Btn: missing kit/components/Btn/Btn.story.tsx` |
| A `jobs/<kind>/job.ts` without `job.test.ts` | `node ops/checks/cli.ts --root <repo>` | `presence: jobs/solo/job.ts: missing jobs/solo/job.test.ts` |
| A kit component with its own menu, listbox, combobox, dialog or ArrowDown/Escape handling and no Radix or cmdk import | `node ops/checks/cli.ts --root <repo>` | `radix: kit/components/Pop/Pop.tsx: draws or handles role="menu itself; import @radix-ui/* or cmdk for behaviour (§ui.mockup)` |
| A view under `areas/` or `shell/` that renders a raw `<input>`, `<button>`, `<select>` or `<textarea>` | `node ops/checks/cli.ts --root <repo>` | `controls: areas/x/X.view.tsx: renders a raw <button>; use the kit component (Button, Field, TextArea, Choice, TextOptions...), adding it to kit/ first if missing (§ui.kit-leads)` |
| A kind written to the generic docs table that is not on the shrinking allow list (`ALLOWED` in `ops/checks/docskinds.ts`) | `node ops/checks/cli.ts --root <repo>` | `docs-kinds: server/flash.ts: line 1 writes kind "flashcards" to the generic docs table; give it its own table and command (docs/proposals/table-design.md), or, ...` |
| An export that only its own tests import (`knip --production -c knip.production.json`, run by the custom checks; tests are not entries there) | `node ops/checks/cli.ts --root <repo>` | `unused-exports: domain/tested.ts: line 2 exports testOnly, which only tests import; use it in the app, un-export it, or delete it with its tests (§drift.checks)` |
| A `§id` in source (not tests) that CONTRACT does not define, or that `docs/contract/ended.md` lists | `node ops/checks/cli.ts --root <repo>` | `source-ids: domain/cite.ts: line 1 cites §nope.missing, which is not defined in CONTRACT.md; cite a live rule or drop the citation (§drift.checks)` |
| An open or blocked Chart task whose done bar names an ev4 path (`tools/`, `core/`, `pwa/`, `page/`, `spec.<key>`) | `node ops/checks/cli.ts --root <repo>` | `chart-ev4: chart/tasks.json: X-9: the done bar names the ev4 path "tools/foo.mjs"; rewrite it in v5 terms` |
| A table in `data/migrations` made since the kind-table design with no kind-prefixed id (`CHECK (substr(id, ...))`), `at` or `v`, or any table not named in `row-shapes.test.ts` | `node ops/checks/cli.ts --root <repo>` | `migration-shape: data/migrations/0099_x.sql: table widgets: id must be TEXT PRIMARY KEY CHECK (substr(id, ...) = '<kind>_') so it carries its kind (§data.tables)` |
| An `e2e/`, `data/staging/` or `ops/` file that issues a PUT and names `/docs` | `node ops/checks/cli.ts --root <repo>` | `docs-writes: e2e/seed.journey.spec.ts: line 1 writes by PUT /docs; write through a command instead (§data.gate)` |
| A tool defined outside the registry | `node ops/checks/cli.ts --root <repo>` | `registry: server/tool.ts: a Claude tool definition outside commands/` |
| A `jobs/runtime/models.ts` checked more than its age limit ago (a warning, exit 0) | `node ops/checks/cli.ts --root <repo>` | `warning: models: jobs/runtime/models.ts: model ids and prices were last checked on 2020-01-01, ... days ago (limit 90). Check them against the Anthropic docs.` |

## Notes

- Table shapes `data/migrations/row-shapes.test.ts` already holds every listed table's columns to its domain row shape by PRAGMA (so `deleted_at` where the row shape has it, and required columns); it goes red if a column differs. It cannot see a table missing from its list or a missing id prefix, so `migration-shape` covers those. `migration-shape` exempts 20 older tables (`LEGACY`, dated 2026-11-06, shrinking); `docs-writes` allows three e2e files (`notes`, `practice-set`, `prep-plan` journeys), dated 2026-11-06, each to go when its kind moves to a command.
- Allow lists, all dated 2026-11-06 and shrinking, never growing: `knip.production.json` `ignoreIssues` lists the 18 folders whose exports have no app consumer yet (15 domain folders waiting for their commands and areas, `jobs/**`, `jobs/runtime/**` and `shell/**`); delete a folder's line when its consumer lands. The allow lists of `ops/checks/sourceids.ts` and `ops/checks/chartev4.ts` are empty and stay empty.
- `unused-exports` runs only where `knip.production.json` exists, so other fixtures stay fast.
- The checks run from a temp repo, so `package.json` there declares no dependencies; otherwise knip would report the real app's dependencies as unused. `knip.json` is copied untouched.
- Not yet proven: the other custom checks (`rules`, `secrets`, `stack`, `trailer`) have their own tests in `ops/checks/checks.test.ts`; `generate --check` and the TypeScript step are not covered here.
- `npm test` and CI do not run `ops/guards/` yet: that needs `ops/guards/` added to the `test` script in `package.json`, which is outside this task's slice.
