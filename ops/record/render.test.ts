import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChart } from './chart.ts';
import { generatedFiles } from './render.ts';
import { EV4_HEADERS } from './fixtures-ev4/headers.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

test("the carried Chart, with ev4's headers, renders ev4's committed files byte for byte", () => {
  const files = generatedFiles(loadChart(ROOT), EV4_HEADERS);
  for (const [name, text] of Object.entries(files)) {
    const want = fs.readFileSync(path.join(HERE, 'fixtures-ev4', name), 'utf8');
    if (text !== want) {
      const a = text.split('\n'),
        b = want.split('\n'),
        i = a.findIndex((l, n) => l !== b[n]);
      assert.fail(`${name} differs at line ${i + 1}:\n got: ${a[i]}\nwant: ${b[i]}`);
    }
  }
});

test('the committed v5 renders in docs/record are in step with the Chart', () => {
  for (const [name, text] of Object.entries(generatedFiles(loadChart(ROOT))))
    assert.equal(fs.readFileSync(path.join(ROOT, 'docs', 'record', name), 'utf8'), text, name);
});
