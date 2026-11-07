import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkSubjectWords } from './subjectwords.ts';

const w = (...p: string[]): string => p.join('');

test('subject-word: whole words in any case fail in source and seeds, not in tests, docs or longer words', () => {
  const files: Record<string, string> = {
    'domain/a.ts': `// ${w('Nurs', 'ing')} basics\n`,
    'domain/b.ts': `export const x = '${w('NC', 'LEX')}';\n`,
    'data/seed.json': `{"t":"${w('NUR', ' 112')}"}\n`,
    'jobs/p.ts': `const cjs = '${w('cj', 'Step')}';\n`,
    'domain/c.ts': `export const dataset = 'a${w('ti')}c ${w('pati', 'ently')}';\n`,
    'domain/a.test.ts': `// ${w('pati', 'ent')}\n`,
    'docs/x.md': w('clin', 'ical'),
    'chart/tasks.json': w('dos', 'age'),
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  const found = checkSubjectWords(root, Object.keys(files));
  assert.deepEqual(found.map(f => f.file).sort(), ['data/seed.json', 'domain/a.ts', 'domain/b.ts', 'jobs/p.ts']);
});
