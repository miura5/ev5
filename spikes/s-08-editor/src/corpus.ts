// S-08 spike: a synthetic corpus (made-up text only). `normal` cases are what ev4 stores (its noteBlocks leaves them
// unchanged): the round trip must give them back deep-equal and byte-equal. `loose` cases are schema-valid but not in
// ev4's normal form; ev4 itself normalises them on load, so the bar for them is noteBlocks(input).
// `from` names the ev4 test or behaviour each case stands for.
import type { Block, NoteDoc, Run } from './model.ts';

const r = (text: string, m: Omit<Run, 'text'> = {}): Run => ({ text, ...m });
const p = (text: string): Block => ({ type: 'p', runs: [r(text)] });
const KEY = 'note-images/abcdEFGH12345678.png';

export interface Case {
  name: string;
  group: string;
  from: string;
  blocks: Block[];
}

const combos: Run[] = [];
for (let n = 0; n < 32; n++) {
  const m: Omit<Run, 'text'> = {};
  if (n & 1) m.b = true;
  if (n & 2) m.i = true;
  if (n & 4) m.u = true;
  if (n & 8) m.s = true;
  if (n & 16) m.href = 'https://example.com/c' + n;
  combos.push(r('w' + n + ' ', m));
}

export const normal: Case[] = [
  // ---- block types
  { group: 'block: p', name: 'paragraph', from: 'schema', blocks: [p('Plain words.')] },
  { group: 'block: p', name: 'empty paragraph', from: 'schema; SAMPLE last line', blocks: [{ type: 'p', runs: [] }] },
  { group: 'block: h1', name: 'heading 1', from: 'schema', blocks: [{ type: 'h1', runs: [r('Cardiac cycle')] }] },
  { group: 'block: h2', name: 'heading 2', from: 'schema', blocks: [{ type: 'h2', runs: [r('Systole')] }] },
  { group: 'block: h3', name: 'heading 3', from: 'schema', blocks: [{ type: 'h3', runs: [r('Diastole')] }] },
  { group: 'block: h1', name: 'empty heading (new note)', from: 'B-440', blocks: [{ type: 'h1', runs: [] }, { type: 'p', runs: [] }] },
  { group: 'block: ul', name: 'bulleted item', from: 'schema', blocks: [{ type: 'ul', runs: [r('one')] }, { type: 'ul', runs: [r('two')] }] },
  { group: 'block: ol', name: 'numbered item', from: 'schema', blocks: [{ type: 'ol', runs: [r('first')] }, { type: 'ol', runs: [r('second')] }] },
  {
    group: 'block: todo',
    name: 'checklist ticked and not',
    from: 'schema; harness checklist',
    blocks: [
      { type: 'todo', runs: [r('done thing')], checked: true },
      { type: 'todo', runs: [r('open thing')], checked: false },
    ],
  },
  { group: 'block: todo', name: 'empty checklist item', from: 'B-402 Enter in todo', blocks: [{ type: 'todo', runs: [], checked: false }] },
  { group: 'block: img', name: 'picture, key only', from: 'B-653', blocks: [{ type: 'img', runs: [], key: KEY }] },
  {
    group: 'block: img',
    name: 'picture with width and alt',
    from: 'B-653 noteImageBlock',
    blocks: [{ type: 'img', runs: [], key: KEY, width: 480, alt: 'heart diagram' }],
  },
  {
    group: 'block: img',
    name: 'picture widths at the limits, every file type',
    from: 'B-653 resize clamp',
    blocks: [
      { type: 'img', runs: [], key: 'note-images/' + 'a'.repeat(16) + '.png', width: 40 },
      { type: 'img', runs: [], key: 'note-images/' + 'B'.repeat(64) + '.jpg', width: 2000 },
      { type: 'img', runs: [], key: 'note-images/abcdefgh12345678.webp', alt: 'x' },
      { type: 'img', runs: [], key: 'note-images/abcdefgh12345678.gif' },
    ],
  },
  { group: 'block: img', name: 'two pictures in a row (adjacent)', from: 'B-653', blocks: [{ type: 'img', runs: [], key: KEY }, { type: 'img', runs: [], key: KEY }] },

  // ---- marks
  { group: 'mark: b', name: 'bold', from: 'schema', blocks: [{ type: 'p', runs: [r('a '), r('bold', { b: true }), r(' z')] }] },
  { group: 'mark: i', name: 'italic', from: 'schema', blocks: [{ type: 'p', runs: [r('italic', { i: true })] }] },
  { group: 'mark: u', name: 'underline', from: 'schema', blocks: [{ type: 'p', runs: [r('under', { u: true })] }] },
  { group: 'mark: s', name: 'strikethrough', from: 'schema', blocks: [{ type: 'ul', runs: [r('Normal range: '), r('3.5 to 5.0', { s: true })] }] },
  { group: 'mark: href', name: 'link with query', from: 'SAMPLE', blocks: [{ type: 'p', runs: [r('see '), r('the page', { href: 'https://example.com/a?b=1&c=2#f' }), r(' after')] }] },
  { group: 'mark: all', name: 'all 32 combinations of b, i, u, s, href', from: 'schema', blocks: [{ type: 'p', runs: combos }] },
  {
    group: 'mark: href',
    name: 'two different links side by side',
    from: 'schema',
    blocks: [{ type: 'p', runs: [r('one', { href: 'http://example.com/1' }), r('two', { href: 'http://example.com/2' })] }],
  },
  {
    group: 'mark: all',
    name: 'marks on headings, list and checklist items',
    from: 'B-439',
    blocks: [
      { type: 'h2', runs: [r('IM and '), r('Subcutaneous', { b: true })] },
      { type: 'ol', runs: [r('Clean', { i: true, u: true })] },
      { type: 'todo', runs: [r('Next', { s: true })], checked: true },
    ],
  },

  // ---- text
  { group: 'text', name: 'unicode: emoji, CJK, RTL, combining, astral', from: 'synthetic', blocks: [p('héllo 🫀 心臓 قلب é 𝄞 ½ ≤ α')] },
  { group: 'text', name: 'markup characters stay text', from: 'B-402 tags; B-439', blocks: [p('infants & <toddlers> "q" \'a\' <script>x</script>')] },
  { group: 'text', name: 'spaces kept: leading, trailing, runs of', from: 'synthetic', blocks: [p('  two  spaces  ')] },
  { group: 'text', name: 'a run of exactly 20,000 characters', from: 'schema run max', blocks: [{ type: 'p', runs: [r('x'.repeat(20000), { b: true })] }] },
  {
    group: 'text',
    name: 'a 45,000-character run, stored as 3 runs at the cap',
    from: 'B-402 review (noteRuns long)',
    blocks: [{ type: 'p', runs: [r('y'.repeat(20000), { i: true }), r('y'.repeat(20000), { i: true }), r('y'.repeat(5000), { i: true })] }],
  },

  // ---- nesting
  {
    group: 'nesting',
    name: 'indent 1 to 6 on each list kind',
    from: 'schema indent; harness nesting',
    blocks: (['ul', 'ol', 'todo'] as const).flatMap(t =>
      [0, 1, 2, 3, 4, 5, 6].map(d => {
        const b: Block = { type: t, runs: [r(t + d)] };
        if (t === 'todo') b.checked = d % 2 === 1;
        if (d) b.indent = d;
        return b;
      })
    ),
  },
  { group: 'nesting', name: 'SAMPLE nested bullet', from: 'B-402 SAMPLE', blocks: [{ type: 'ul', runs: [r('top')] }, { type: 'ul', runs: [r('nested item')], indent: 1 }] },
  { group: 'nesting', name: 'jump from 0 to 3', from: 'synthetic (noteIndent allows it)', blocks: [{ type: 'ul', runs: [r('a')] }, { type: 'ul', runs: [r('b')], indent: 3 }] },
  { group: 'nesting', name: 'first line of the note indented', from: 'synthetic', blocks: [{ type: 'ol', runs: [r('deep')], indent: 2 }] },
  {
    group: 'nesting',
    name: 'indented item right after a paragraph',
    from: 'B-402 Backspace (p then ul indent 1)',
    blocks: [p('one'), { type: 'ul', runs: [r('two')], indent: 1 }],
  },
  {
    group: 'nesting',
    name: 'kinds mixed across depths',
    from: 'synthetic',
    blocks: [
      { type: 'ul', runs: [r('bullet')] },
      { type: 'todo', runs: [r('task under bullet')], checked: false, indent: 1 },
      { type: 'ol', runs: [r('number under task')], indent: 2 },
      { type: 'ol', runs: [r('back to 1')], indent: 1 },
      { type: 'ul', runs: [r('top again')] },
      { type: 'ol', runs: [r('ol at top after ul')] },
    ],
  },
  {
    group: 'nesting',
    name: 'empty list items at depth',
    from: 'B-402 keepEmpty',
    blocks: [{ type: 'ul', runs: [] }, { type: 'ul', runs: [], indent: 1 }, { type: 'todo', runs: [], checked: true, indent: 1 }],
  },

  // ---- two-column rows (B-654)
  {
    group: 'row',
    name: 'picture right, text left',
    from: 'B-654 noteMakeRow(start,1,2,1)',
    blocks: [{ type: 'h1', runs: [r('Heart')] }, { ...p('Four chambers.'), row: 'r1', col: 0 }, { type: 'img', runs: [], key: KEY, width: 480, row: 'r1', col: 1 }, p('Valves.')],
  },
  {
    group: 'row',
    name: 'picture left, text right',
    from: 'B-654 noteMakeRow(start,1,2,0)',
    blocks: [{ type: 'h1', runs: [r('Heart')] }, { type: 'img', runs: [], key: KEY, row: 'r1', col: 0 }, { ...p('Four chambers.'), row: 'r1', col: 1 }, p('Valves.')],
  },
  {
    group: 'row',
    name: 'harness row: p, h2, ul beside a picture',
    from: 'harness B-654 (text, heading and list typed in the column)',
    blocks: [
      { type: 'h1', runs: [r('Heart')] },
      { ...p('Four chambers. Right side.'), row: 'r1', col: 0 },
      { type: 'h2', runs: [r('Valves')], row: 'r1', col: 0 },
      { type: 'ul', runs: [r('Mitral')], row: 'r1', col: 0 },
      { type: 'img', runs: [], key: KEY, width: 300, alt: 'valves', row: 'r1', col: 1 },
      { type: 'p', runs: [] },
    ],
  },
  {
    group: 'row',
    name: 'row first and last in the note, two rows touching',
    from: 'synthetic',
    blocks: [
      { ...p('L1'), row: 'a', col: 0 },
      { ...p('R1'), row: 'a', col: 1 },
      { ...p('L2'), row: 'b', col: 0 },
      { ...p('R2'), row: 'b', col: 1 },
      p('middle'),
      { type: 'todo', runs: [r('task')], checked: true, indent: 2, row: 'Z9', col: 0 },
      { type: 'ol', runs: [], row: 'Z9', col: 0 },
      { type: 'img', runs: [], key: KEY, row: 'Z9', col: 1 },
      { type: 'img', runs: [], key: KEY, alt: 'two', row: 'Z9', col: 1 },
    ],
  },
  {
    group: 'row',
    name: 'row id at the 16-character limit, marks inside',
    from: 'schema row pattern',
    blocks: [
      { type: 'p', runs: [r('b', { b: true }), r('link', { href: 'https://example.com' })], row: 'ABCDEFGH12345678', col: 0 },
      { type: 'p', runs: [], row: 'ABCDEFGH12345678', col: 1 },
    ],
  },

  // ---- behaviour outputs, as ev4's tests expect them
  {
    group: 'behaviour',
    name: 'B-402 SAMPLE (editor tree round trip)',
    from: 'notes-editor.test B-402 round trip',
    blocks: [
      { type: 'h1', runs: [r('Fluids and electrolytes')] },
      { type: 'p', runs: [r('Two of them, '), r('bold', { b: true }), r(' and '), r('both', { b: true, i: true, u: true })] },
      { type: 'h2', runs: [r('Potassium')] },
      { type: 'ul', runs: [r('Normal range: '), r('3.5 to 5.0', { s: true })] },
      { type: 'ul', runs: [r('nested item')], indent: 1 },
      { type: 'ol', runs: [r('first')] },
      { type: 'ol', runs: [r('second')] },
      { type: 'todo', runs: [r('done thing')], checked: true },
      { type: 'todo', runs: [r('open thing')], checked: false },
      { type: 'h3', runs: [r('A link')] },
      { type: 'p', runs: [r('see '), r('the page', { href: 'https://example.com/a?b=1' }), r(' after')] },
      { type: 'p', runs: [] },
    ],
  },
  {
    group: 'behaviour',
    name: 'Enter split in a marked list item',
    from: 'notes-editor.test Enter',
    blocks: [{ type: 'ul', runs: [r('a', { b: true })] }, { type: 'ul', runs: [r('b', { b: true }), r('cd')] }],
  },
  {
    group: 'behaviour',
    name: 'mark toggled across two blocks',
    from: 'notes-editor.test noteSetMark',
    blocks: [{ type: 'p', runs: [r('hello '), r('world', { b: true })] }, { type: 'p', runs: [r('sec', { b: true }), r('ond')] }],
  },
  {
    group: 'behaviour',
    name: 'sanitised paste output',
    from: 'notes-editor.test paste stripped',
    blocks: [
      { type: 'h1', runs: [r('Heading')] },
      { type: 'p', runs: [r('Plain '), r('bold', { b: true }), r(' '), r('styled', { i: true, u: true }), r('bad link '), r('good link', { href: 'https://ok.example/x' })] },
      { type: 'ul', runs: [r('one')] },
      { type: 'ul', runs: [r('two')] },
      { type: 'ul', runs: [r('deeper')], indent: 1 },
      { type: 'ol', runs: [r('first')] },
      { type: 'todo', runs: [r('ticked')], checked: true },
      { type: 'h3', runs: [r('Small & tidy <b>')] },
      { type: 'p', runs: [r('ab')] },
    ],
  },
  {
    group: 'behaviour',
    name: 'paste at the caret, many lines',
    from: 'notes-editor.test noteInsertBlocks',
    blocks: [{ type: 'p', runs: [r('startA')] }, { type: 'ul', runs: [r('B')] }, { type: 'p', runs: [r('Cend')] }],
  },
  {
    group: 'behaviour',
    name: 'picture inserted, then moved under the heading',
    from: 'note-images.test insert/move',
    blocks: [{ type: 'h1', runs: [r('Heart')] }, { type: 'img', runs: [], key: KEY, width: 480, alt: 'heart diagram' }, p('Four chambers.'), p('Valves.')],
  },
  {
    group: 'behaviour',
    name: 'heading typed inside a column',
    from: 'note-images.test B-654 Enter + setType in column',
    blocks: [
      { type: 'h1', runs: [r('Heart')] },
      { ...p('Four chambers.'), row: 'r1', col: 0 },
      { type: 'h2', runs: [r('Valves')], row: 'r1', col: 0 },
      { type: 'img', runs: [], key: KEY, width: 480, row: 'r1', col: 1 },
      p('Valves.'),
    ],
  },
  {
    group: 'behaviour',
    name: '400 formatted runs in one line (the schema limit)',
    from: 'notes-editor.test 450 spans (split to 400 a line on paste)',
    blocks: [{ type: 'p', runs: Array.from({ length: 400 },(_, i) => r('x' + i, i % 2 ? { b: true } : {})) }],
  },
  {
    group: 'limits',
    name: '4,000 lines, every type in turn',
    from: 'schema maxItems; B-402 5,000-line paste refused',
    blocks: Array.from({ length: 4000 }, (_, i): Block => {
      const k = i % 6;
      if (k === 0) return { type: 'h2', runs: [r('Section ' + i)] };
      if (k === 1) return { type: 'p', runs: [r('line ' + i + ' '), r('bold', { b: true })] };
      if (k === 2) return { type: 'ul', runs: [r('item ' + i)], indent: i % 3 };
      if (k === 3) return { type: 'todo', runs: [r('task ' + i)], checked: i % 2 === 0 };
      if (k === 4) return { type: 'ol', runs: [r('step ' + i)] };
      return { type: 'img', runs: [], key: KEY, width: 100 + (i % 500) };
    }).map(b => (b.indent === 0 ? (({ indent, ...x }) => x)(b) : b) as Block),
  },
];

// schema-valid, not in ev4's normal form (ev4 normalises them on load and on save)
export const loose: Case[] = [
  { group: 'loose', name: 'empty run', from: 'schema allows text ""', blocks: [{ type: 'p', runs: [r(''), r('a')] }] },
  { group: 'loose', name: 'neighbour runs with the same marks', from: 'schema', blocks: [{ type: 'p', runs: [r('a', { b: true }), r('b', { b: true })] }] },
  { group: 'loose', name: 'checked on a paragraph', from: 'schema allows checked on any block', blocks: [{ type: 'p', runs: [r('a')], checked: true }] },
  { group: 'loose', name: 'indent on a heading', from: 'schema allows indent on any block', blocks: [{ type: 'h1', runs: [r('a')], indent: 2 }] },
  { group: 'loose', name: 'explicit indent 0', from: 'schema minimum 0', blocks: [{ type: 'ul', runs: [r('a')], indent: 0 }] },
  { group: 'loose', name: 'todo without checked', from: 'schema', blocks: [{ type: 'todo', runs: [r('a')] }] },
  { group: 'loose', name: 'a row with one column', from: 'B-654 lone row mark', blocks: [p('a'), { ...p('b'), row: 'r9', col: 1 }] },
  { group: 'loose', name: 'columns out of order', from: 'B-654 gathered, column 0 first', blocks: [{ ...p('R'), row: 'r1', col: 1 }, { ...p('L'), row: 'r1', col: 0 }] },
  { group: 'loose', name: 'row without col', from: 'schema (col optional)', blocks: [{ ...p('a'), row: 'r1' }] },
  { group: 'loose', name: 'one row split by another block', from: 'B-654 tidy', blocks: [{ ...p('L'), row: 'r1', col: 0 }, p('mid'), { ...p('R'), row: 'r1', col: 1 }] },
  { group: 'loose', name: 'picture with runs of text', from: 'schema', blocks: [{ type: 'img', runs: [r('caption?')], key: KEY }] },
  { group: 'loose', name: 'picture without a key', from: 'schema (key optional)', blocks: [{ type: 'img', runs: [] }] },
  { group: 'loose', name: 'control characters and nbsp in text', from: 'cleanText', blocks: [p('a\nb\tc d​e')] },
  { group: 'loose', name: 'emoji with zero-width joiner (ev4 strips U+200D)', from: 'cleanText', blocks: [p('nurse 👩‍⚕️')] },
  { group: 'loose', name: 'no blocks at all', from: 'schema minItems 0', blocks: [] },
];

const T0 = '2026-10-26T15:00:00.000Z';
export const docs: { name: string; from: string; doc: NoteDoc }[] = [
  {
    name: 'plain note in a course',
    from: 'B-402 noteDoc',
    doc: { schema: 1, writer: 'page', at: T0, source: 'E.V. Home', createdAt: T0, title: 'Fluids', course: 'NUR 112', blocks: [{ type: 'h1', runs: [r('Fluids')] }, p('x')], editedAt: T0 },
  },
  {
    name: 'label, no course, archived',
    from: 'schema label; archivedAt mark',
    doc: {
      schema: 1, writer: 'page', at: T0, source: 'E.V. Home', createdAt: '2026-10-20T10:00:00.000Z', title: 'Renal system', course: null,
      blocks: [{ type: 'h2', runs: [r('Renal system')] }], editedAt: T0, label: 'Lecture 9', archivedAt: '2026-10-25T09:00:00.000Z',
    },
  },
  {
    name: 'earlierOf copy (stale save kept both)',
    from: 'B-404 / D-326 keepBoth, earlierDoc',
    doc: {
      schema: 1, writer: 'page', at: T0, source: 'E.V. Home', createdAt: T0, title: 'Renal system (earlier)', course: 'BIO 201',
      blocks: [p('x'), { type: 'h2', runs: [r('Renal system')] }], editedAt: T0, label: 'Lecture 3', earlierOf: 'n-20261019-100000-abcdefghijkl',
      archivedAt: null,
    },
  },
  {
    name: 'discarded, then brought back (null)',
    from: 'discardedAt mark',
    doc: {
      schema: 1, writer: 'page', at: T0, source: 'E.V. Home', createdAt: T0, title: '', course: null, blocks: [{ type: 'p', runs: [] }], editedAt: T0,
      discardedAt: null,
    },
  },
  {
    name: 'note with a row and a picture',
    from: 'B-653/B-654 harness save',
    doc: {
      schema: 1, writer: 'page', at: T0, source: 'E.V. Home', createdAt: T0, title: 'Heart', course: 'BIO 201',
      blocks: [{ type: 'h1', runs: [r('Heart')] }, { ...p('Four chambers.'), row: 'r1', col: 0 }, { type: 'img', runs: [], key: KEY, width: 480, row: 'r1', col: 1 }],
      editedAt: T0,
    },
  },
];
