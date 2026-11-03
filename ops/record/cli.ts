// The Chart's only write path: node ops/record/cli.ts <command> [flags]. Flags: --root <repo> (default: this repo),
// --now <ISO time> (default: the clock). Exit 0 on success, 1 on a refusal, a red lint or renders out of step.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChart, saveChart } from './chart.ts';
import type { Chart } from './chart.ts';
import { decisionAdd, decisionSet, releaseAdd } from './decisions.ts';
import { formatLint, lintChart } from './lint.ts';
import { generatedFiles } from './render.ts';
import { taskAdd, taskClaim, taskSet } from './tasks.ts';
import type { Done, Opts } from './tasks.ts';

export const USAGE = `node ops/record/cli.ts <command>
  task add --title <t> --milestone <m> [--dod <d>] [--depends B-1,B-2] [--notes <n>] [--source <s>]
           [--kind bug|request --words <w> --source <s>]
  task set <B-id> [--status open|blocked|done|declined] [--notes <n>] [--commit <sha>] [--title <t>] [--dod <d>]
           [--milestone <m>] [--depends <ids>] [--reason <r>] [--waiting-on Matt|none] [--where mac|staging|github|decision]
  task claim <B-id> --by <run>
  decision add --title <t> [--why <w>] [--status proposed|accepted|superseded|revisit] [--supersedes <ids>]
           [--amends <ids>] [--kind decision|tenet --scope <s> --checked-by <c>] [--source <s>]
  decision set <D-id> [same flags as add]
  release add --version v5.x.y --target staging|live --commit <sha> --summary <s> [--tasks <ids>] [--decisions <ids>]
           [--ok Matt] [--time <ISO>]
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
  'release add': releaseAdd,
};

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
  if (!check) log('docs/record/BACKLOG.md, DECISIONS.md and CHANGELOG.md rendered from chart/');
  return red ? 1 : 0;
}

/** Runs one command; returns the exit code. Every write saves the Chart and re-renders, so they never drift. */
export function main(argv: string[], log: (s: string) => void = console.log, err = console.error): number {
  const o = parseArgs(argv);
  const root = typeof o.root === 'string' ? path.resolve(o.root) : path.resolve(fileURLToPath(import.meta.url), '../../..');
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
    const write = WRITES[`${cmd} ${sub}`];
    if (!write) {
      err(USAGE);
      return 1;
    }
    const done = write(rec, o, now);
    saveChart(root, rec);
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
