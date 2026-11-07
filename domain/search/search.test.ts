import { expect, test } from 'vitest';
import { buildIndex, chunkMaterials, likePatterns, search, type Material } from './index.ts';

// The retrieval test set: a small synthetic corpus (made up) from mixed learners, with the passage each query must put first.
const corpus: Material[] = [
  {
    id: 'acct-ch7',
    title: 'Ch 7 - Ledger Entries.pdf',
    collection_id: 'col_alpha',
    text: '[p1] Ledger overview. Where accounts record their balances.\n[p2] Posting splits each payment into two invoice entries in the journal.\n[p3] The reconciliation cycle runs in the closing ledger.',
  },
  {
    id: 'interview-guide',
    kind: 'guide',
    title: 'Interview prep guide',
    collection_id: 'col_interview',
    text: '[p1] Research the company. Read the job post twice.\n[p2] Answer behavioral questions with the STAR method: situation, task, action, result.\n[p3] Prepare three questions to ask the interviewer at the end.',
  },
  {
    id: 'spanish-u3',
    title: 'Unit 3 slides',
    collection_id: 'col_spanish',
    text: '[s1] Preterite tense / Regular verbs\n[s2] Irregular verbs: ser and ir share the same forms',
  },
  {
    id: 'old',
    title: 'Half marathon plan.pdf',
    text: '[Page 1] Easy runs first. [Page 2] Long run on Sunday; slow the pace before the hills.',
  },
];

const chunks = chunkMaterials(corpus);
const idx = buildIndex(chunks);
const top = (q: string) => search(idx, q)[0];

const EXPECTED: [string, string, number][] = [
  ['payment split into invoice entries', 'acct-ch7', 2],
  ['reconciliation cycle closing ledger', 'acct-ch7', 3],
  ['STAR method for behavioral answers', 'interview-guide', 2],
  ['which questions to ask the interviewer', 'interview-guide', 3],
  ['irregular verbs ser ir', 'spanish-u3', 2],
  ['preterite tense', 'spanish-u3', 1],
  ['long run pace', 'old', 2],
];

test.each(EXPECTED)('retrieval: "%s" ranks %s page %i first', (q, id, page) => {
  expect(top(q)).toMatchObject({ id, page });
});

test('chunks keep their page, unit and collection; ', () => {
  expect(chunks.find((c) => /reconciliation/.test(c.text))?.page).toBe(3);
  expect(top('STAR method for behavioral answers')?.kind).toBe('guide');
  expect(top('reconciliation cycle closing ledger')?.collection_id).toBe('col_alpha');
  expect(top('long run pace')).toMatchObject({ kind: 'note', collection_id: null });
});

test('a long page splits into passages that keep the page', () => {
  const sentence = 'Verbs change their ending with the subject. ';
  const p = chunkMaterials([{ id: 'x', text: `[p4] ${sentence.repeat(60)}` }], 300);
  expect(p.length).toBeGreaterThan(3);
  expect(p.every((c) => c.page === 4 && c.text.length <= 300 * 1.6 + sentence.length)).toBe(true);
});

test('filters: collection, kind, id', () => {
  expect(search(idx, 'irregular verbs', { collections: new Set(['col_alpha']) })).toEqual([]);
  expect(search(idx, 'irregular verbs', { collections: new Set(['col_spanish']) })[0]?.page).toBe(2);
  expect(search(idx, 'questions', { kind: 'guide' }).every((h) => h.kind === 'guide')).toBe(true);
  expect(search(idx, 'payment', { id: 'spanish-u3' })).toEqual([]);
});

test('stop-word and empty queries find nothing; at most two passages per file and k results', () => {
  expect(search(idx, 'the of and')).toEqual([]);
  expect(search(buildIndex([]), 'ledger')).toEqual([]);
  const many = chunkMaterials([
    {
      id: 'm',
      text: '[p1] ledger one.\n[p2] ledger two.\n[p3] ledger three.',
    },
  ]);
  expect(search(buildIndex(many), 'ledger').length).toBe(2);
  expect(search(idx, 'ledger questions verbs', { k: 1 }).length).toBe(1);
});

test('similar words do not collide (conjunction vs conjugation)', () => {
  const i = buildIndex(chunkMaterials([{ id: 'a', text: '[p1] Conjugation changes a verb for its subject.' }]));
  expect(search(i, 'conjunction')).toEqual([]);
});

test('LIKE patterns are safe, deduplicated and match like the SQL does', () => {
  expect(likePatterns('the 50% Ledger ledger')).toEqual(['%50%', '%ledger%']);
  expect(likePatterns("x'; DROP_%")).toEqual(['%drop%']);
});
