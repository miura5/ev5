import { expect, test } from 'vitest';
import { buildIndex, chunkMaterials, cite, likeMatch, likePatterns, search, type Material } from './index.ts';

// The retrieval test set: a small synthetic corpus (made up) with the passage each query must put first.
// Ported from ev4 test/library.test.mjs.
const corpus: Material[] = [
  {
    id: 'NUR112-1',
    title: 'Ch 42 - Fluid, Electrolyte, and Acid-Base Balance.pdf',
    course: 'NUR 112',
    text: '[p1] Fluid balance overview. Body water compartments.\n[p2] Hypokalemia: potassium below 3.5 mEq/L causes muscle weakness and dysrhythmias.\n[p3] Hyperkalemia: peaked T waves.',
  },
  {
    id: 'NUR112-2',
    kind: 'lab',
    title: 'SKILLS PACKET',
    course: 'NUR 112',
    text: '[p1] Head-to-toe assessment. Perform hand hygiene. Verify two identifiers.\n[p2] Auscultate heart sounds at five landmarks: aortic, pulmonic, Erb point, tricuspid, mitral.\n[p3] Sterile gloves: open the package without touching the inner wrapper.',
  },
  {
    id: 'BIO201-9',
    title: 'Chapter 7 ppt',
    course: 'BIO 201',
    text: '[s1] Bones of the skull / Frontal bone\n[s2] Vertebral column',
  },
  {
    id: 'old',
    title: 'Ch 30 - Health Assessment.pdf',
    text: '[Page 1] Inspection first. [Page 2] Palpation of the abdomen comes last; auscultate bowel sounds before palpating.',
  },
];

const chunks = chunkMaterials(corpus);
const idx = buildIndex(chunks);
const top = (q: string) => search(idx, q)[0];

const EXPECTED: [string, string, number][] = [
  ['low potassium weakness', 'NUR112-1', 2],
  ['peaked T waves', 'NUR112-1', 3],
  ['auscultating heart sound landmarks', 'NUR112-2', 2],
  ['how do I handle sterile gloves', 'NUR112-2', 3],
  ['vertebral column', 'BIO201-9', 2],
  ['skull bones', 'BIO201-9', 1],
  ['auscultate bowel sounds', 'old', 2],
];

test.each(EXPECTED)('retrieval: "%s" ranks %s page %i first', (q, id, page) => {
  expect(top(q)).toMatchObject({ id, page });
});

test('chunks keep their page and unit; citations read like E.V. writes them', () => {
  expect(chunks.find((c) => /peaked/.test(c.text))?.page).toBe(3);
  expect(cite(top('auscultating heart sound landmarks')!)).toBe('SKILLS PACKET, p. 2');
  expect(cite(top('vertebral column')!)).toBe('Chapter 7 ppt, slide 2');
  expect(cite(top('auscultate bowel sounds')!)).toBe('Ch 30 - Health Assessment, p. 2');
  expect(top('auscultating heart sound landmarks')?.kind).toBe('lab');
});

test('a long page splits into passages that keep the page', () => {
  const sentence = 'Potassium shifts into cells with insulin. ';
  const p = chunkMaterials([{ id: 'x', text: `[p4] ${sentence.repeat(60)}` }], 300);
  expect(p.length).toBeGreaterThan(3);
  expect(p.every((c) => c.page === 4 && c.text.length <= 300 * 1.6 + sentence.length)).toBe(true);
});

test('filters: course, kind, id', () => {
  expect(search(idx, 'skull bones', { courses: new Set(['NUR 112']) })).toEqual([]);
  expect(search(idx, 'skull bones', { courses: new Set(['BIO 201']) })[0]?.page).toBe(1);
  expect(search(idx, 'assessment', { kind: 'lab' }).every((h) => h.kind === 'lab')).toBe(true);
  expect(search(idx, 'potassium', { id: 'BIO201-9' })).toEqual([]);
});

test('stop-word and empty queries find nothing; at most two passages per file and k results', () => {
  expect(search(idx, 'the of and')).toEqual([]);
  expect(search(buildIndex([]), 'potassium')).toEqual([]);
  const many = chunkMaterials([
    {
      id: 'm',
      text: '[p1] potassium one.\n[p2] potassium two.\n[p3] potassium three.',
    },
  ]);
  expect(search(buildIndex(many), 'potassium').length).toBe(2);
  expect(search(idx, 'potassium assessment sounds', { k: 1 }).length).toBe(1);
});

test('similar words do not collide (hyperkalemia vs hyperglycemia)', () => {
  const i = buildIndex(chunkMaterials([{ id: 'a', text: '[p1] Hyperglycemia means high glucose.' }]));
  expect(search(i, 'hyperkalemia')).toEqual([]);
});

test('LIKE patterns are safe, deduplicated and match like the SQL does', () => {
  expect(likePatterns('the 50% Potassium potassium')).toEqual(['%50%', '%potassium%']);
  expect(likePatterns("x'; DROP_%")).toEqual(['%drop%']);
  expect(likeMatch('Low POTASSIUM level', 'potassium?')).toBe(true);
  expect(likeMatch('sodium', 'the potassium')).toBe(false);
});
