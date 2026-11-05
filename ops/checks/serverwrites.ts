// SQL lives in data/ only (§data.gate, §data.protocol): no other folder (tests and ops aside) holds a prepare() with an
// INSERT, UPDATE or DELETE. A write belongs in a data/ repository, where the version pin and the Worker clock apply.
// In jobs/ no SQL at all is allowed, SELECT included: the job runtime reads and writes through data/ repositories.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const WRITE = /\.prepare\(\s*(?:`|"|')\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;
const ANY_SQL = /\.prepare\(\s*(?:`|"|')\s*(?:SELECT|WITH|INSERT|UPDATE|DELETE|REPLACE)\b/i;

// Known, until they move into data/.
const UNTIL_MOVED = new Set<string>();

export function checkServerWrites(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!/^(?!data\/|ops\/).+\.ts$/.test(f) || /\.test\.ts$/.test(f) || UNTIL_MOVED.has(f)) continue;
    const src = read(root, f);
    if (f.startsWith('jobs/') ? ANY_SQL.test(src) : WRITE.test(src))
      out.push({ check: 'server-writes', file: f, detail: 'holds SQL outside data/; move it to a data/ repository (§data.gate)' });
  }
  return out;
}
