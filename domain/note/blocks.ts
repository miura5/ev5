import { BLOCK_TYPES, LIST_TYPES, MARKS, MAX, type Block, type Run } from './types.ts';

export const IMG_KEY = /^note-images\/[A-Za-z0-9]{16,64}\.(png|jpg|webp|gif)$/;
export const HREF = /^https?:\/\/[^\s<>"]+$/;
export const ROW = /^[A-Za-z0-9]{1,16}$/;

type Loose = Record<string, unknown> | null | undefined;
const isHref = (h: unknown): h is string => typeof h === 'string' && h.length <= MAX.href && HREF.test(h);
const sameMarks = (a: Run, b: Run) => MARKS.every((k) => !a[k] === !b[k]) && (a.href ?? '') === (b.href ?? '');

/** Text as stored: no zero-width characters, tabs as spaces, no control characters. */
const cleanText = (s: unknown): string =>
  String(s ?? '')
    .replace(/ /g, ' ')
    .replace(/[​‌‍⁠﻿]/g, '')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '');

/** Where a block sits: its row and column in a two-column row, or nothing at full width. */
const placeOf = (b: Loose): Pick<Block, 'row' | 'col'> =>
  b && ROW.test(String(b.row ?? '')) && (b.col === 0 || b.col === 1) ? { row: b.row as string, col: b.col } : {};

/**
 * Runs as stored: no empty text, neighbours with the same marks joined, a run past 20000 characters carried on as more
 * runs with the same marks. Nothing is cut; a block past 400 runs is kept whole (see splitWide and fits).
 */
export function noteRuns(runs: unknown): Run[] {
  const out: Run[] = [];
  for (const r of Array.isArray(runs) ? (runs as Loose[]) : []) {
    if (!r || typeof r.text !== 'string') continue;
    const text = cleanText(r.text);
    if (!text) continue;
    const m: Omit<Run, 'text'> = {};
    for (const k of MARKS) if (r[k] === true) m[k] = true;
    if (isHref(r.href)) m.href = r.href;
    const last = out[out.length - 1];
    if (last && sameMarks(last, m as Run)) last.text += text;
    else out.push({ text, ...m });
  }
  const capped: Run[] = [];
  for (const r of out)
    for (let i = 0; i < r.text.length; i += MAX.text) capped.push({ ...r, text: r.text.slice(i, i + MAX.text) });
  return capped;
}

/** One block as stored: a known type, its runs, checked on a checklist item only, indent 1 to 6 on a list item only. */
export function noteBlock(b: Loose): Block {
  if (b && b.type === 'img' && IMG_KEY.test(String(b.key ?? ''))) {
    const out: Block = { type: 'img', runs: [], key: b.key as string };
    const w = Math.floor(Number(b.width) || 0);
    if (w) out.width = Math.max(MAX.imgMin, Math.min(MAX.imgMax, w));
    if (typeof b.alt === 'string' && b.alt) out.alt = cleanText(b.alt).slice(0, MAX.alt);
    return Object.assign(out, placeOf(b));
  }
  const type = BLOCK_TYPES.find((t) => t === b?.type) ?? 'p';
  const out: Block = { type, runs: noteRuns(b?.runs) };
  if (type === 'todo') out.checked = !!b?.checked;
  const indent = Math.max(0, Math.min(MAX.indent, Math.floor(Number(b?.indent) || 0)));
  if (indent && (LIST_TYPES as readonly string[]).includes(type)) out.indent = indent;
  return Object.assign(out, placeOf(b));
}

type Group = { cols: [Block[], Block[]] };

/** Rows kept whole: a row's blocks gathered where it first appears, column 0 first; a one-column row goes full width. */
function tidyRows(blocks: Block[]): Block[] {
  if (!blocks.some((b) => b.row)) return blocks;
  const seen = new Map<string, Group>();
  const out: (Block | Group)[] = [];
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
    g.cols[b.col ?? 0].push(b);
  }
  return out.flatMap((x) => {
    if (!('cols' in x)) return [x];
    const all = [...x.cols[0], ...x.cols[1]];
    if (x.cols[0].length && x.cols[1].length) return all;
    return all.map(({ row: _row, col: _col, ...rest }) => rest);
  });
}

/** A note's blocks as stored: at least one (an empty paragraph). Never cut to 4000: the editor refuses past it. */
export function noteBlocks(blocks: unknown): Block[] {
  const out = tidyRows((Array.isArray(blocks) ? (blocks as Loose[]) : []).map(noteBlock));
  return out.length ? out : [{ type: 'p', runs: [] }];
}

/** Blocks with more than 400 runs split into following paragraphs of 400 runs each, all text kept. */
export function splitWide(blocks: unknown): Block[] {
  return noteBlocks(blocks).flatMap((b) => {
    if (b.runs.length <= MAX.runs) return [b];
    const parts: Block[] = [];
    for (let i = 0; i < b.runs.length; i += MAX.runs) {
      const runs = b.runs.slice(i, i + MAX.runs);
      parts.push(i ? { type: 'p', runs } : { ...b, runs });
    }
    return parts;
  });
}

export const blockText = (b: { runs?: Run[] } | null | undefined): string =>
  (b?.runs ?? []).map((r) => r.text).join('');

/** The note's title: its first heading 1, else its first heading 2 or 3, cut to 300 characters; empty when none. */
export function noteTitleOf(blocks: Block[]): string {
  const h = blocks.find((b) => b.type === 'h1') ?? blocks.find((b) => b.type === 'h2' || b.type === 'h3');
  return h ? blockText(h).replace(/\s+/g, ' ').trim().slice(0, MAX.title) : '';
}

/** A note with no words in it; such a new note is never written. */
export const noteBlank = (blocks: Block[]): boolean => !blocks.some((b) => /\S/.test(blockText(b)));
