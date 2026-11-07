// E.V. is subject-agnostic: no subject word may appear in non-test source, prompts or seeds (§drift.checks). Whole
// words in any case, no allow list. Tests, the Chart, docs and Markdown are history or fixtures and are not scanned.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

// The words are spelled in pieces so this file does not contain them.
const WORDS = [['nurs', 'ing'], ['nur', 'se'], ['nur', 'ses'], ['nc', 'lex'], ['sa', 'ta'], ['clin', 'ical'], ['dos', 'age'], ['cj', 'step'], ['pati', 'ent'], ['pati', 'ents'], ['a', 'ti'], ['nur', ' ?\\d{3}'], ['bio', ' ?\\d{3}']].map(p => p.join(''));
const WORD = new RegExp(`\\b(?:${WORDS.join('|')})\\b`, 'i');
const SCANNED = /\.(?:tsx?|tsx|css|[cm]?js|sh|sql|jsonc?|toml|ya?ml|html|txt|prompt)$/;
const SKIPPED = /(?:^|\/)(?:node_modules|dist|chart|docs|fixtures-[\w-]+|guards)\/|\.(?:test|spec)\.tsx?$|^package-lock\.json$|^ops\/checks\/subjectwords\.ts$/;

export function checkSubjectWords(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCANNED.test(f) || SKIPPED.test(f)) continue;
    const lines = read(root, f).split('\n');
    const hits = lines.map((t, i) => (WORD.test(t) ? i + 1 : 0)).filter(Boolean);
    if (hits.length) out.push({ check: 'subject-word', file: f, detail: `${hits.length} line(s), first ${hits[0]}, name a subject; use a plain neutral word (§drift.checks)` });
  }
  return out;
}
