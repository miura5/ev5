// S-08 spike: the part of ev4's pure note model (ev4 core/notes.mjs) a round trip needs, ported to TypeScript by
// reading it (ev4's code is never run here). noteBlocks is ev4's save-time normaliser; noteDoc is the save allowlist
// (core/notes.mjs, the function at lines 948-964): the envelope a save writes, and nothing else.

export type Mark = 'b' | 'i' | 'u' | 's';
export interface Run {
  text: string;
  b?: true;
  i?: true;
  u?: true;
  s?: true;
  href?: string;
}
export type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'todo' | 'img';
export interface Block {
  type: BlockType;
  runs: Run[];
  checked?: boolean;
  indent?: number;
  key?: string;
  width?: number;
  alt?: string;
  row?: string;
  col?: 0 | 1;
}
export interface NoteDoc {
  schema: 1;
  writer: 'page';
  at: string;
  source: string;
  createdAt: string;
  title: string;
  course?: string | null;
  label?: string;
  blocks: Block[];
  editedAt?: string;
  earlierOf?: string;
  archivedAt?: string | null;
  discardedAt?: string | null;
}

export const TYPES = ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'todo'] as const;
export const LISTS = ['ul', 'ol', 'todo'];
export const MARKS: Mark[] = ['b', 'i', 'u', 's'];
export const MAX = { blocks: 4000, runs: 400, text: 20000, href: 2000, title: 300, indent: 6, imgMin: 40, imgMax: 2000 };
const IMG_KEY = /^note-images\/[A-Za-z0-9]{16,64}\.(png|jpg|webp|gif)$/;
const HREF = /^https?:\/\/[^\s<>"]+$/;
const ROW = /^[A-Za-z0-9]{1,16}$/;

const placeOf = (b: Partial<Block> | undefined): Pick<Block, 'row' | 'col'> =>
  b && ROW.test(String(b.row || '')) && (b.col === 0 || b.col === 1) ? { row: b.row, col: b.col } : {};

export const cleanText = (s: unknown): string =>
  String(s == null ? '' : s)
    .replace(/ /g, ' ')
    .replace(/[​‌‍⁠﻿]/g, '')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '');
export const linkOk = (h: unknown): h is string => typeof h === 'string' && h.length <= MAX.href && HREF.test(h);

function marksOf(r: Partial<Run> | undefined): Omit<Run, 'text'> {
  const m: Omit<Run, 'text'> = {};
  for (const k of MARKS) if (r && r[k] === true) m[k] = true;
  if (r && linkOk(r.href)) m.href = r.href;
  return m;
}
const sameMarks = (a: Omit<Run, 'text'>, b: Omit<Run, 'text'>) =>
  MARKS.every(k => !a[k] === !b[k]) && (a.href || '') === (b.href || '');

export function noteRuns(runs: Partial<Run>[] | undefined): Run[] {
  const out: Run[] = [];
  for (const r of runs || []) {
    if (!r || typeof r.text !== 'string') continue;
    const text = cleanText(r.text);
    if (!text) continue;
    const m = marksOf(r);
    const last = out[out.length - 1];
    if (last && sameMarks(last, m)) last.text += text;
    else out.push({ text, ...m });
  }
  const capped: Run[] = [];
  for (const r of out) for (let i = 0; i < r.text.length; i += MAX.text) capped.push({ ...r, text: r.text.slice(i, i + MAX.text) });
  return capped;
}

export function noteBlock(b: Partial<Block>): Block {
  if (b && b.type === 'img' && IMG_KEY.test(String(b.key || ''))) {
    const out: Block = { type: 'img', runs: [], key: b.key };
    const w = Math.floor(Number(b.width) || 0);
    if (w) out.width = Math.max(MAX.imgMin, Math.min(MAX.imgMax, w));
    if (typeof b.alt === 'string' && b.alt) out.alt = cleanText(b.alt).slice(0, MAX.title);
    return Object.assign(out, placeOf(b));
  }
  const type = (b && (TYPES as readonly string[]).includes(b.type as string) ? b.type : 'p') as BlockType;
  const out: Block = { type, runs: noteRuns(b && b.runs) };
  if (type === 'todo') out.checked = !!(b && b.checked);
  const ind = Math.max(0, Math.min(MAX.indent, Math.floor(Number(b && b.indent) || 0)));
  if (ind && LISTS.includes(type)) out.indent = ind;
  return Object.assign(out, placeOf(b));
}

export function noteTidyRows(blocks: Block[]): Block[] {
  if (!blocks.some(b => b.row)) return blocks;
  type G = { cols: [Block[], Block[]] };
  const seen = new Map<string, G>();
  const out: (Block | G)[] = [];
  for (const b of blocks) {
    if (!b.row) {
      out.push(b);
      continue;
    }
    let g = seen.get(b.row);
    if (!g) {
      g = { cols: [[], []] };
      seen.set(b.row, g);
      out.push(g);
    }
    g.cols[b.col as 0 | 1].push(b);
  }
  return out.flatMap(x => {
    if (!('cols' in x)) return [x];
    if (x.cols[0].length && x.cols[1].length) return [...x.cols[0], ...x.cols[1]];
    return [...x.cols[0], ...x.cols[1]].map(b => {
      const c = { ...b };
      delete c.row;
      delete c.col;
      return c;
    });
  });
}

export function noteBlocks(blocks: unknown): Block[] {
  const out = noteTidyRows((Array.isArray(blocks) ? blocks : []).map(noteBlock));
  return out.length ? out : [{ type: 'p', runs: [] }];
}

const blockText = (b: Block) => (b && b.runs ? b.runs.map(r => r.text).join('') : '');
export function noteTitleOf(blocks: Block[]): string {
  const h = (blocks || []).find(b => b.type === 'h1') || (blocks || []).find(b => /^h[23]$/.test(b.type));
  return h ? blockText(h).replace(/\s+/g, ' ').trim().slice(0, MAX.title) : '';
}
const EARLIER = ' (earlier)';
export function noteEarlierTitle(title: string): string {
  const t = String(title || '').endsWith(EARLIER) ? String(title).slice(0, -EARLIER.length) : String(title || '');
  return (t.trim() || 'Untitled').slice(0, MAX.title - EARLIER.length) + EARLIER;
}

/** ev4's save allowlist (noteDoc): identity and marks kept from prev, blocks and title from the editor. */
export function noteDoc(
  prev: NoteDoc | null,
  { blocks, course, label, at, source }: { blocks: Block[]; course?: string | null; label?: string; at: string; source?: string }
): NoteDoc {
  const b = noteBlocks(blocks);
  const doc: NoteDoc = {
    schema: 1,
    writer: 'page',
    at,
    source: source || 'E.V. Home',
    createdAt: (prev && prev.createdAt) || at,
    title: prev && prev.earlierOf ? noteEarlierTitle(noteTitleOf(b)) : noteTitleOf(b),
    course: course === undefined ? (prev && prev.course !== undefined ? prev.course : null) : course,
    blocks: b,
    editedAt: at,
  };
  const lab = label !== undefined ? label : prev && prev.label;
  if (typeof lab === 'string' && lab) doc.label = lab.slice(0, 80);
  for (const k of ['earlierOf', 'archivedAt', 'discardedAt'] as const)
    if (prev && prev[k] !== undefined) (doc as unknown as Record<string, unknown>)[k] = prev[k];
  return doc;
}
