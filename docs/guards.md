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
| A tool defined outside the registry | `node ops/checks/cli.ts --root <repo>` | `registry: server/tool.ts: a Claude tool definition outside commands/` |
| A write fixture ev4's schema rejects | `node --test data/compat/validate.test.ts` | the fixture, listed as valid, fails: `not ok - notes: accepts ev4 rejects this` with `/html: unknown field` |

## Notes

- The compat guard is the suite itself: a write that ev4's frozen schema refuses must be listed under `invalid` in `data/compat/samples/writes.ts`. The test copies `data/compat`, adds a note with an unknown field to `valid`, and the suite goes red. (The runtime path, `validateWrite`, has no CLI of its own; the Worker will call it from the repository layer.)
- The checks run from a temp repo, so `package.json` there declares no dependencies; otherwise knip would report the real app's dependencies as unused. `knip.json` is copied untouched.
- Not yet proven: the other custom checks (`rules`, `secrets`, `trailer`) have their own tests in `ops/checks/checks.test.ts`; `generate --check` and the TypeScript step are not covered here.
- `npm test` and CI do not run `ops/guards/` yet: that needs `ops/guards/` added to the `test` script in `package.json`, which is outside this task's slice.
