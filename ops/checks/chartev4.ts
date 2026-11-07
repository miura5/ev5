// An open Chart task must not name a path of the old app in its done bar: tools/, core/, pwa/, page/ or spec.<key> are its
// files, and v5 has none of them (§drift.checks). Reads chart/tasks.json; done and dropped tasks are history.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const EV4_PATH = /(?<![\w./-])(?:tools|core|pwa|page)\/[\w./-]+|(?<![\w.-])spec\.[a-z][\w.]*/;

// Paths found in open done bars, still to be rewritten through the Chart; delete each line then.
// Never add one.
const ALLOWED = new Set<string>([]);

export function checkChartEv4(root: string, files: string[]): Finding[] {
  if (!files.includes('chart/tasks.json')) return [];
  const data = JSON.parse(read(root, 'chart/tasks.json')) as unknown;
  const tasks = (Array.isArray(data) ? data : (data as { tasks?: unknown[] }).tasks ?? []) as { id: string; status?: string; dod?: string }[];
  return tasks.filter(t => (t.status === 'open' || t.status === 'blocked')).flatMap(t => {
    const m = (t.dod ?? '').match(EV4_PATH);
    return m && !ALLOWED.has(m[0].replace(/\.$/, '')) ? [{ check: 'chart-paths', file: 'chart/tasks.json', detail: `${t.id}: the done bar names the old app's path "${m[0]}"; rewrite it in v5 terms` }] : [];
  });
}
