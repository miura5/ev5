# E.V. v5

E.V. is a personal knowledge app for one learner with any goal: school, a certification, an interview, a career move, or learning for its own sake. It keeps notes and sessions, writes and runs practice, tracks weak spots against your dates, plans the day, and talks with you as a partner. E.V. asks for your attempt first and cites your own notes.

v5 is a rebuild of ev4. ev4 stays live until cutover.

This page holds the facts that stay true for months. For the state of the build today, read [docs/handover.md](docs/handover.md) and the [task list](docs/record/BACKLOG.md).

## The stack

The table names each main part, its packages and why we use it. A check compares the package names in this table with `package.json` (see [Keeping this page true](#keeping-this-page-true)).

<!-- stack:start -->
| Part | Packages | Why |
|---|---|---|
| Cloudflare Worker | none: set in wrangler.jsonc | One Worker runs the server and serves the app's files. No server to look after. |
| Cloudflare D1 | none: the DB binding | v5's own database, which started empty. ev4's data stays untouched as an archive. SQLite at the edge, with Time Travel backups. |
| Cloudflare R2 | none: the IMAGES binding | Note pictures and the nightly export. |
| Cloudflare Workflows | none: the JOBS binding | Long jobs (practice sets, prep plans) run as steps that survive a restart. |
| Server routes | `hono` | Small router made for Workers. |
| Schemas | `zod` | One schema per thing. Types, checks and tool schemas come from it. |
| Model calls | `@anthropic-ai/sdk` | Claude writes practice, plans and Ask E.V. replies. |
| Screens | `react`, `react-dom` | The app's views. |
| Menus and dialogs | `@radix-ui/react-*` | Unstyled parts that handle keys and focus. The kit gives them E.V.'s look. |
| Command palette | `cmdk` | The ⌘K palette. |
| Routing | `wouter` | Back, Forward and reload keep the screen and its open item. |
| Notes editor | `prosemirror-*` | Rich notes that save as plain blocks. |
| Build | `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa` | Fast builds, and the app works offline as an installed app. |
| Language | `typescript` | Types across server, jobs and screens. |
| Tests | `vitest`, `jsdom`, `@testing-library/react`, `@playwright/test` | Unit and screen tests, and browser journeys on staging. Some ops, data and server tests use Node's own test runner. |
| Guards | `eslint`, `dependency-cruiser`, `stylelint`, `knip` | File size, import direction, colours from tokens, and no unused code. |
<!-- stack:end -->

## How the parts fit

```
browser                     Worker (server/)
  shell/  ─┐                  routes ─▶ commands/ ─▶ domain/
  areas/  ─┼─▶ commands/client ─▶ │          │        ▲
  kit/   ◀─┘                      ▼          ▼        │
                               jobs/ ───▶ data/ ─▶ D1, R2
```

- **domain/**: pure rules (goals and dates, notes, sets, weak spots, time). No reads or writes.
- **data/**: reads and writes D1 and R2, migrations, the export and the restore.
- **commands/**: one registry of actions. Buttons, ⌘K, the schedule and E.V.'s tools all come from it.
- **jobs/**: long model work on Workflows, with one job record and spend ceilings.
- **server/**: the Hono Worker. Routes call commands.
- **kit/**: E.V.'s design system. Tokens, components and patterns. The `/kit` page shows them all.
- **shell/**: the sidebar, the Detail panel, ⌘K, the offline outbox and the screens that no one area owns.
- **areas/**: one folder per sidebar item (Today, Ask, Library, Notes, Progress, Activity and more).
- **ops/**: the record writer, the checks, the cutover list and the restore drill.
- **e2e/**: Playwright journeys and the kit's picture tests.

dependency-cruiser keeps imports in this direction. Each folder's README lists what it exports.

## Where things live

| What | Where |
|---|---|
| The rules | [CONTRACT.md](CONTRACT.md) (every rule has a `§id`) |
| The plan and its reasons | [PLAN.md](PLAN.md) |
| How the agents build | [AGENTS.md](AGENTS.md) |
| The look | [design/mockup.html](design/mockup.html), then [kit/](kit/) |
| Tasks and decisions | `chart/*.json`, written by `ops/record`. Read [BACKLOG](docs/record/BACKLOG.md) and [DECISIONS](docs/record/DECISIONS.md) |
| Today's state | [docs/handover.md](docs/handover.md) |
| The guards and their red output | [docs/guards.md](docs/guards.md) |
| Cutover and restore | [ops/CUTOVER.md](ops/CUTOVER.md), [ops/RESTORE.md](ops/RESTORE.md) |
| History | [docs/history/](docs/history/) (context, not instructions) |

## Setup for a fresh clone

1. Install Node 26 (see `engines` in `package.json`), then run `npm ci`.
2. Run `npm run dev` for the app, and `npm run precheck` for every check CI runs.
3. In GitHub, add these repository secrets. Each is a value you make once:
   - `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN_STAGING`;
   - `ANTHROPIC_API_KEY_STAGING`, with a low spend cap;
   - `TOKEN_APP_STAGING`, `TOKEN_SCHEDULE_STAGING` and `TOKEN_EXECUTOR_STAGING`: long random strings. The app token is the one you paste into the app's token screen.
4. Make a GitHub environment named `live` with the owner as its required reviewer. Put `CLOUDFLARE_API_TOKEN_LIVE` in it.
5. Protect `main`: require the CI checks and turn on auto-merge.
6. Open one pinned issue for the owner's questions and release cards.
7. Make a Claude Code scheduled task named "E.V. v5 build" on this repo, with [prompts/START-BUILD.md](prompts/START-BUILD.md) as its prompt.

A merge to `main` deploys the staging Worker. The staging workflow makes its D1 database and R2 bucket when they are missing. Secrets stay in GitHub and Cloudflare, not in files (§hard.no-secrets-in-files).

## The owner's part

Questions and release cards come as comments on the pinned issue. Turn on notifications for it in the GitHub app, and reply there in plain words.

- **Release cards** say what to try on staging, by screen. Reply **"ship"** when you like it, **"bug: …"** for a problem (screenshots help) or **"idea: …"** for the list after the current work.
- **Questions** come batched in one comment, with a default first. Reply with a number, or **"ok"** for the default.
- **"exam week"** pauses new features, and the build fixes bugs. **"exam's over"** starts features again.
- **Only you decide** live deploys, money, accounts and secrets, anything on your Mac, changes to something you use daily, and exceptions to something you asked for (§who.matt).
- **A live deploy** happens on your word, after staging, through the `live` environment you approve in GitHub (§hard.live-on-matts-word).
- **Before cutover:** test v5 on staging like a normal day of learning. At cutover, say **"go live"**, approve the deploy in GitHub, and keep your devices online so no unsent notes stay behind.
- After cutover, E.V. keeps the same app address and the same phone icon. If you want the optional Canvas import, be at your Mac once while the agent makes its task.

## Keeping this page true

- Each release updates this page when the stack, the folders, the setup or the owner's part changes ([AGENTS.md §8](AGENTS.md#8-the-release-card-what-matt-reads)).
- `npm run checks` fails when the stack table names a package that is not installed, or when a package in `dependencies` has no row.
