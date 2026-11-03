import { HREF, IMG_KEY, ROW } from './blocks.ts';
import { docBytes } from './size.ts';
import { BLOCK_TYPES, MAX, type Note } from './types.ts';

const KEYS = new Set([
  'schema',
  'writer',
  'at',
  'source',
  'createdAt',
  'title',
  'course',
  'label',
  'blocks',
  'editedAt',
  'earlierOf',
  'archivedAt',
  'discardedAt',
]);
const BLOCK_KEYS = new Set(['type', 'runs', 'checked', 'indent', 'key', 'width', 'alt', 'row', 'col']);
const RUN_KEYS = new Set(['text', 'b', 'i', 'u', 's', 'href']);
const EARLIER_OF = /^n-[A-Za-z0-9-]{1,120}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTime = (v: unknown) => typeof v === 'string' && TIME.test(v) && !Number.isNaN(Date.parse(v));
const int = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

function parseRun(r: unknown): void {
  if (!isObj(r)) throw new Error('note: run is not an object');
  for (const k of Object.keys(r)) if (!RUN_KEYS.has(k)) throw new Error(`note: unexpected run field ${k}`);
  if (typeof r.text !== 'string' || r.text.length > MAX.text) throw new Error('note: bad run text');
  for (const k of ['b', 'i', 'u', 's']) if (k in r && r[k] !== true) throw new Error(`note: bad run mark ${k}`);
  if ('href' in r && !(typeof r.href === 'string' && r.href.length <= MAX.href && HREF.test(r.href)))
    throw new Error('note: bad run link');
}

function parseBlock(b: unknown): void {
  if (!isObj(b)) throw new Error('note: block is not an object');
  for (const k of Object.keys(b)) if (!BLOCK_KEYS.has(k)) throw new Error(`note: unexpected block field ${k}`);
  if (b.type !== 'img' && !(BLOCK_TYPES as readonly unknown[]).includes(b.type))
    throw new Error('note: bad block type');
  if (!Array.isArray(b.runs) || b.runs.length > MAX.runs) throw new Error('note: bad block runs');
  b.runs.forEach(parseRun);
  if ('checked' in b && typeof b.checked !== 'boolean') throw new Error('note: bad checked');
  if ('indent' in b && !int(b.indent, 0, MAX.indent)) throw new Error('note: bad indent');
  if ('key' in b && !(typeof b.key === 'string' && IMG_KEY.test(b.key))) throw new Error('note: bad picture key');
  if ('width' in b && !int(b.width, MAX.imgMin, MAX.imgMax)) throw new Error('note: bad picture width');
  if ('alt' in b && !(typeof b.alt === 'string' && b.alt.length <= MAX.alt)) throw new Error('note: bad alt');
  if ('row' in b && !(typeof b.row === 'string' && ROW.test(b.row))) throw new Error('note: bad row');
  if ('col' in b && b.col !== 0 && b.col !== 1) throw new Error('note: bad col');
}

/** Validates a note document against the frozen ev4 schema 1; throws otherwise. */
export function parseNote(raw: unknown): Note {
  if (!isObj(raw)) throw new Error('note: not an object');
  for (const k of Object.keys(raw)) if (!KEYS.has(k)) throw new Error(`note: unexpected field ${k}`);
  if (raw.schema !== 1) throw new Error('note: schema must be 1');
  if (raw.writer !== 'page') throw new Error('note: bad writer');
  if (typeof raw.source !== 'string' || !raw.source) throw new Error('note: source is required');
  if (!isTime(raw.at) || !isTime(raw.createdAt)) throw new Error('note: at and createdAt are required times');
  if (typeof raw.title !== 'string' || raw.title.length > MAX.title) throw new Error('note: bad title');
  if (raw.course != null && !(typeof raw.course === 'string' && raw.course)) throw new Error('note: bad course');
  if ('label' in raw && !(typeof raw.label === 'string' && raw.label.length <= MAX.label))
    throw new Error('note: bad label');
  if (!Array.isArray(raw.blocks) || raw.blocks.length > MAX.blocks) throw new Error('note: bad blocks');
  raw.blocks.forEach(parseBlock);
  if ('editedAt' in raw && !isTime(raw.editedAt)) throw new Error('note: bad editedAt');
  if ('earlierOf' in raw && !(typeof raw.earlierOf === 'string' && EARLIER_OF.test(raw.earlierOf)))
    throw new Error('note: bad earlierOf');
  for (const k of ['archivedAt', 'discardedAt'])
    if (k in raw && raw[k] !== null && !isTime(raw[k])) throw new Error(`note: bad ${k}`);
  return raw as unknown as Note;
}

/**
 * Why a write leaving `doc` (prev: as stored, null for a create) is refused, or null when it is sound: the schema, the
 * 256 KB cap, and createdAt and earlierOf written once and never changed.
 */
export function writeProblem(doc: unknown, prev: Note | null): string | null {
  let note: Note;
  try {
    note = parseNote(doc);
  } catch (e) {
    return (e as Error).message;
  }
  const size = docBytes(note);
  if (size > MAX.documentBytes) return `note is ${size} bytes; a note holds at most ${MAX.documentBytes}`;
  if (prev)
    for (const k of ['createdAt', 'earlierOf'] as const)
      if (JSON.stringify(prev[k]) !== JSON.stringify(note[k]))
        return `note: ${k} is written once, when the note is made, and never changed`;
  return null;
}
