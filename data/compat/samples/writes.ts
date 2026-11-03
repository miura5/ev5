// Synthetic v5 writes to the ev4 collections v5 touches at cutover, each one ev4 would accept (valid) or refuse
// (invalid, with the reason the refusal must name). Made-up content only.

export interface Sample {
  name: string;
  doc: Record<string, unknown>;
  id?: string;
  prev?: Record<string, unknown>;
  /** invalid only: a pattern the refusal's lines must match. */
  why?: RegExp;
}
export type Samples = Record<string, { valid: Sample[]; invalid: Sample[] }>;

const AT = '2026-11-02T15:00:00Z';
const env = (writer = 'page', source = 'v5/test') => ({ writer, at: AT, source });

const note = { schema: 1, ...env('page', 'v5/notes'), createdAt: AT, title: 'Cardiac output', course: 'BIO 201',
  blocks: [{ type: 'h1', runs: [{ text: 'Preload' }] }, { type: 'p', runs: [{ text: 'Stretch before ', b: true }, { text: 'contraction.' }] }] };
const notePrev = { ...note, source: 'page', title: 'Draft' };

const day = { schema: 1, ...env(), date: '2026-11-03', updatedAt: AT,
  added: { 'rep-x1-2026-11-03': { text: 'Read chapter 4', kind: 'reading', minutes: 30, at: AT, by: 'Matt' } } };

const date = { schema: 1, ...env(), date: '2026-11-20', title: 'Skills check-off', kind: 'other', course: null };
const canvasDate = { schema: 1, ...env('canvas-sync', 'canvas-sync'), date: '2026-11-20', title: 'Quiz 3', kind: 'due', canvasId: 77 };

const spot = { schema: 2, ...env('morning', 'morning/2026-11-01'), topic: 'Frank-Starling law', objective: 'bio201-e2-03',
  kind: 'concept', initial: {}, events: { 'page-20261101-090000': { type: 'seen', by: 'owner', at: '2026-11-01T09:00:00Z' } } };
const solid = { 'page-20261102-150000': { type: 'solid', by: 'owner', at: AT } };

const item = { id: 'q1', type: 'single', stem: 'Which change raises stroke volume?', options: ['More preload', 'Less preload'], correct: [0] };
const set = { schema: 3, ...env(), kind: 'drill', date: '2026-11-02', exam: null, items: [item], createdAt: AT };

const answer = { schema: 2, ...env('page', 'page'), setId: 'set-1', answers: { q1: { 'page-20261101-100000': { chosen: 1, correct: false, at: '2026-11-01T10:00:00Z' } } } };
const attempt = { 'page-20261102-150000': { chosen: 0, correct: true, score: 1, at: AT } };

export const SAMPLES: Samples = {
  notes: {
    valid: [
      { name: 'a new note', doc: note },
      { name: 'an edit of his note: title and blocks are marks, the envelope is kept', doc: { ...notePrev, title: 'Cardiac output', blocks: note.blocks, editedAt: AT }, prev: notePrev },
    ],
    invalid: [
      { name: 'a new field', doc: { ...note, html: '<b>x</b>' }, why: /\/html: unknown field/ },
      { name: 'a new writer value', doc: { ...note, writer: 'v5' }, why: /\/writer: "v5" is not an existing writer/ },
      { name: 'a source that does not name v5', doc: { ...note, source: 'page' }, why: /\/source/ },
      { name: 'a time that is not ISO UTC', doc: { ...note, createdAt: '2026-11-02T15:00:00+00:00' }, why: /createdAt.*date-time/ },
      { name: 'a title over 300 UTF-16 units (151 emoji: 302 units, 151 code points)', doc: { ...note, title: '\u{1F600}'.repeat(151) }, why: /\/title/ },
      { name: 'createdAt changed', doc: { ...notePrev, createdAt: '2026-11-03T00:00:00Z' }, prev: notePrev, why: /\/createdAt: write-once/ },
      { name: 'earlierOf added to a note that exists', doc: { ...notePrev, earlierOf: 'n-abc' }, prev: notePrev, why: /\/earlierOf/ },
      { name: 'a block type that does not exist', doc: { ...note, blocks: [{ type: 'table', runs: [] }] }, why: /blocks\/0\/type/ },
    ],
  },
  dayedits: {
    valid: [{ name: 'his own plan item, a repeat occurrence under its idempotent key', doc: day }],
    invalid: [
      { name: 'an added item by v5', doc: { ...day, added: { a: { ...day.added['rep-x1-2026-11-03'], by: 'v5' } } }, why: /added\/a\/by/ },
      { name: 'a new kind of item', doc: { ...day, added: { a: { ...day.added['rep-x1-2026-11-03'], kind: 'meeting' } } }, why: /kind/ },
      { name: 'a time on an added item (it belongs in item_props)', doc: { ...day, added: { a: { ...day.added['rep-x1-2026-11-03'], time: '09:00' } } }, why: /\/time: unknown field/ },
    ],
  },
  dates: {
    valid: [{ name: 'a date that is not an exam', doc: date }],
    invalid: [
      { name: 'a day that does not exist', doc: { ...date, date: '2026-02-30' }, why: /\/date/ },
      { name: 'a new kind', doc: { ...date, kind: 'birthday' }, why: /\/kind/ },
      { name: 'an edit field (edits go in dateedits)', doc: { ...date, editedAt: AT }, why: /\(document\)/ },
      { name: "moving a Canvas date in place: date is canvas-sync's mark", doc: { ...canvasDate, date: '2026-11-21' }, prev: canvasDate, why: /\/date: a mark canvas-sync changes, not page/ },
    ],
  },
  weakspots: {
    valid: [{ name: 'Mark as learned: a solid event appended by the page', doc: { ...spot, events: { ...spot.events, ...solid } }, prev: spot }],
    invalid: [
      { name: 'an event type that does not exist', doc: { ...spot, events: { ...spot.events, 'page-20261102-150000': { type: 'learned', by: 'owner', at: AT } } }, prev: spot, why: /type/ },
      { name: 'an event appended under a writer the map does not name', doc: { ...spot, events: { ...spot.events, 'morning-20261102-150000': solid['page-20261102-150000'] } }, prev: spot, why: /appended by morning/ },
      { name: 'an event removed', doc: { ...spot, events: solid }, prev: spot, why: /never removed/ },
      { name: 'the topic rewritten', doc: { ...spot, topic: 'Starling', events: { ...spot.events, ...solid } }, prev: spot, why: /\/topic: write-once/ },
      { name: 'a snooze without until', doc: { ...spot, events: { ...spot.events, 'page-20261102-150000': { type: 'snooze', at: AT } } }, prev: spot, why: /required property 'until'/ },
    ],
  },
  sets: {
    valid: [{ name: 'a new set typed by the page', doc: set }],
    invalid: [
      { name: "an ev4 set's items edited in place", doc: { ...set, items: [{ ...item, stem: 'Which change lowers stroke volume?' }] }, prev: set, why: /\/items: write-once/ },
      { name: 'a stem under 10 characters', doc: { ...set, items: [{ ...item, stem: 'Why?' }] }, why: /stem/ },
      { name: 'a new item type', doc: { ...set, items: [{ ...item, type: 'card' }] }, why: /type/ },
      { name: 'answers inside a set', doc: { ...set, answers: {} }, why: /\(document\)/ },
    ],
  },
  answers: {
    valid: [{ name: 'a new attempt appended under its item id', doc: { ...answer, answers: { q1: { ...answer.answers.q1, ...attempt } } }, prev: answer }],
    invalid: [
      { name: 'an earlier attempt rewritten', doc: { ...answer, answers: { q1: { 'page-20261101-100000': { chosen: 0, correct: true, at: AT } } } }, prev: answer, why: /never changed/ },
      { name: 'a score above 1', doc: { ...answer, answers: { q1: { ...answer.answers.q1, 'page-20261102-150000': { ...attempt['page-20261102-150000'], score: 1.5 } } } }, prev: answer, why: /score/ },
      { name: 'a new field on an attempt', doc: { ...answer, answers: { q1: { 'page-20261102-150000': { at: AT, confidence: 3 } } } }, why: /confidence: unknown field/ },
    ],
  },
};
