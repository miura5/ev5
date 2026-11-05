// Handover (AGENTS.md §7): docs/handover.md holds only the current state, so it stays under 4 KB with no line over 600 characters.
import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from './lib.ts';

export const HANDOVER_MAX_BYTES = 4096;
export const HANDOVER_MAX_LINE = 600;

export function checkHandover(root: string, files: string[]): Finding[] {
  const file = 'docs/handover.md';
  if (!files.includes(file)) return [];
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const out: Finding[] = [];
  const bytes = Buffer.byteLength(text);
  if (bytes > HANDOVER_MAX_BYTES) out.push({ check: 'handover', file, detail: `${bytes} bytes, over ${HANDOVER_MAX_BYTES}: keep current state only, the run diary goes in the PR description` });
  text.split('\n').forEach((l, i) => {
    if (l.length > HANDOVER_MAX_LINE) out.push({ check: 'handover', file, detail: `line ${i + 1} has ${l.length} characters, over ${HANDOVER_MAX_LINE}: split it into several lines` });
  });
  return out;
}
