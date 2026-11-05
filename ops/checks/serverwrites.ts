// SQL lives in data/ only (§data.gate, §data.protocol): no other folder (tests and ops aside) holds a prepare() with an
// INSERT, UPDATE or DELETE. A write belongs in a data/ repository, where the version pin and the Worker clock apply.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const WRITE = /\.prepare\(\s*(?:`|"|')\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;

// Known, until they move into data/: the job runtime's ceiling stores (two statements).
const UNTIL_MOVED = new Set(['jobs/runtime/d1-stores.ts']);

export function checkServerWrites(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!/^(?!data\/|ops\/).+\.ts$/.test(f) || /\.test\.ts$/.test(f) || UNTIL_MOVED.has(f)) continue;
    if (WRITE.test(read(root, f))) out.push({ check: 'server-writes', file: f, detail: 'writes SQL outside data/; add the write to a data/ repository (§data.gate)' });
  }
  return out;
}
