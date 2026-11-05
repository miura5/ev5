// The Chart's only write path: node ops/record/cli.ts <command> [flags]. Flags: --root <repo> (default: this repo),
// --now <ISO time> (default: the clock). Exit 0 on success, 1 on a refusal, a red lint or renders out of step.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChart, saveChart } from './chart.ts';
import type { Chart } from './chart.ts';
import { decisionAdd, decisionSet } from './decisions.ts';
import { clearInbox, inboxAdd, inboxFile } from './inbox.ts';
import { formatLint, lintChart } from './lint.ts';
import { generatedFiles } from './render.ts';
import { taskAdd, taskClaim, taskSet } from './tasks.ts';
import type { Done, Opts } from './tasks.ts';

export const USAGE = `node ops/record/cli.ts <command>
  task add --title <t> --milestone <m> [--dod <d>] [--depends B-1,B-2] [--notes <n>] [--source <s>]
           [--kind bug|request --words <w> --source <s>]
  task set <B-id> [--status open|blocked|done|declined] [--notes <n>] [--commit <sha>] [--title <t>] [--dod <d>]
           [--milestone <m>] [--depends <ids>] [--reason <r>] [--waiting-on owner|none] [--where mac|staging|github|decision]
  task claim <B-id> --by <run>
  decision add --title <t> [--why <w>] [--status proposed|accepted|superseded|revisit] [--supersedes <ids>]
           [--amends <ids>] [--kind decision|tenet --scope <s> --checked-by <c>] [--source <s>]
  decision set <D-id> [same flags as add]
  inbox add task|decision --title <t> ...   (any session: queues P-1, P-2 ... in chart/inbox/<session>.json)
  inbox file                                (lock holder: real ids, then deletes the inbox files)
  render [--check]
  lint`;

const BOOLEAN = new Set(['--check']);
export function parseArgs(argv: string[]): Opts {
  const o: Opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (BOOLEAN.has(a)) o[a.slice(2)] = true;
    else if (a.startsWith('--')) {
      const next = argv[i + 1];
      o[a.slice(2)] = next != null && !next.startsWith('--') ? (i++, next) : true;
    } else o._.push(a);
  }
  return o;
}

type Write = (rec: Chart, o: Opts, now: string) => Done;
const WRITES: Record<string, Write> = {
  'task add': taskAdd,
  'task set': taskSet,
  'task claim': taskClaim,
  'decision add': decisionAdd,
  'decision set': decisionSet,
};

const REPO = path.resolve(fileURLToPath(import.meta.url), '../../..');
const SESSION = (): string => process.env.CLAUDE_CODE_REMOTE_SESSION_ID || process.env.BUILD_RUN_ID || '';

/** True when ops/build-lock.sh status shows this session holds the build lock. */
export function holdsBuildLock(): boolean {
  const me = SESSION();
  if (!me) return false;
  const r = spawnSync('bash', [path.join(REPO, 'ops', 'build-lock.sh'), 'status'], { cwd: REPO, encoding: 'utf8' });
  return r.status === 0 && r.stdout.includes(`LOCK: held by ${me} `);
}
// Commands that take a real id, and so need the lock.
const NEEDS_LOCK = new Set(['task add', 'decision add', 'inbox file']);

const recordDir = (root: string): string => path.join(root, 'docs', 'record');

function render(root: string, rec: Chart, check: boolean, log: (s: string) => void): number {
  let red = 0;
  for (const [f, text] of Object.entries(generatedFiles(rec))) {
    const p = path.join(recordDir(root), f);
    if (check) {
      const same = fs.existsSync(p) && fs.readFileSync(p, 'utf8') === text;
      if (!same) red++;
      log(same ? `docs/record/${f}: in step with chart/` : `docs/record/${f}: differs from chart/ (run render)`);
    } else {
      fs.mkdirSync(recordDir(root), { recursive: true });
      fs.writeFileSync(p, text);
    }
  }
  if (!check) log('docs/record/BACKLOG.md and DECISIONS.md rendered from chart/');
  return red ? 1 : 0;
}

/** Runs one command; returns the exit code. Every write saves the Chart and re-renders, so they never drift. */
export function main(
  argv: string[],
  log: (s: string) => void = console.log,
  err = console.error,
  holdsLock: () => boolean = holdsBuildLock,
): number {
  const o = parseArgs(argv);
  const root =
    typeof o.root === 'string' ? path.resolve(o.root) : path.resolve(fileURLToPath(import.meta.url), '../../..');
  const now = typeof o.now === 'string' ? new Date(o.now).toISOString() : new Date().toISOString();
  const [cmd, sub] = o._;
  try {
    const rec = loadChart(root);
    if (cmd === 'render') return render(root, rec, o.check === true, log);
    if (cmd === 'lint') {
      const findings = lintChart(rec);
      log(formatLint(findings));
      return findings.some(f => f.level === 'error') ? 1 : 0;
    }
    const key = `${cmd} ${sub}`;
    if (NEEDS_LOCK.has(key) && !holdsLock())
      throw new Error(
        key === 'inbox file'
          ? 'only the build-lock holder files the inbox (ops/build-lock.sh status)'
          : `${key} needs the build lock (ops/build-lock.sh status): queue it with ops/record inbox add ${sub === 'add' ? cmd : '...'} instead`,
      );
    if (key === 'inbox add') {
      const done = inboxAdd(root, rec, o, typeof o.session === 'string' ? o.session : SESSION());
      log(`${done.id}: ${done.what}`);
      return 0;
    }
    const write =
      key === 'inbox file' ? (r: Chart, _o: Opts, n: string) => inboxFile(root, r, n) : WRITES[`${cmd} ${sub}`];
    if (!write) {
      err(USAGE);
      return 1;
    }
    const done = write(rec, o, now);
    saveChart(root, rec);
    if (key === 'inbox file') clearInbox(root, rec);
    render(root, rec, false, () => {});
    log(`${done.id}: ${done.what}`);
    return 0;
  } catch (e) {
    err(`refused: ${(e as Error).message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv.slice(2));
