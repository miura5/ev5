// The Worker writes through data/ only (§data.protocol): server/ code (tests aside) holds no prepare() with an INSERT,
// UPDATE or DELETE. A write lives in a data/ repository, where the version pin and the Worker clock are applied.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const WRITE = /\.prepare\(\s*(?:`|"|')\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;

export function checkServerWrites(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!/^server\/.+\.ts$/.test(f) || /\.test\.ts$/.test(f)) continue;
    if (WRITE.test(read(root, f))) out.push({ check: 'server-writes', file: f, detail: 'writes with a raw prepare(); add the write to a data/ repository (§data.protocol)' });
  }
  return out;
}
