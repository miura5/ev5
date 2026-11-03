// S-08 spike: runs every corpus case through every path and reports, per case and path, deep-equal and byte-equal
// (JSON.stringify, which is ev4's canonical stored form and what its sameWords compares).
import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { Node as PMNode } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schema } from './schema.ts';
import { tiptapSchema, TIPTAP } from './tiptap.ts';
import { stockFromBlocks, stockToBlocks } from './stock.ts';
import { blocksToDoc, docToBlocks, exportBlocks, capRuns, ev4Order, DIRECT } from './convert.ts';
import { noteBlocks, noteDoc, type Block, type NoteDoc } from './model.ts';
import { normal, loose, docs } from './corpus.ts';

const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const notesSchema = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../fixtures/notes.schema.json'), 'utf8'));
const validate = ajv.compile(notesSchema);
const envelope = (blocks: Block[]) => ({
  schema: 1, writer: 'page', at: '2026-10-26T15:00:00.000Z', source: 'S-08', createdAt: '2026-10-26T15:00:00.000Z', title: '', blocks,
});
export const valid = (doc: unknown) => (validate(doc) ? '' : JSON.stringify(validate.errors?.slice(0, 2)));

export type Path = 'direct-raw' | 'direct' | 'json+state' | 'tiptap' | 'stock-tiptap';
export const PATHS: Path[] = ['direct-raw', 'direct', 'json+state', 'tiptap', 'stock-tiptap'];

function through(p: Path, blocks: Block[]): Block[] {
  switch (p) {
    case 'direct-raw':
      return docToBlocks(DIRECT, blocksToDoc(schema, DIRECT, blocks));
    case 'direct':
      return exportBlocks(DIRECT, blocksToDoc(schema, DIRECT, blocks));
    case 'json+state': {
      // what an editor session does: the doc stored as JSON (IndexedDB, undo), parsed back, held in an EditorState,
      // and a no-op transaction applied
      const json = JSON.parse(JSON.stringify(blocksToDoc(schema, DIRECT, blocks).toJSON()));
      let state = EditorState.create({ doc: PMNode.fromJSON(schema, json) });
      state = state.apply(state.tr.setMeta('noop', true));
      return exportBlocks(DIRECT, state.doc);
    }
    case 'tiptap':
      return exportBlocks(TIPTAP, blocksToDoc(tiptapSchema, TIPTAP, blocks));
    case 'stock-tiptap':
      return ev4Order(capRuns(stockToBlocks(stockFromBlocks(blocks).doc)));
  }
}

export interface Result {
  set: 'normal' | 'loose';
  group: string;
  name: string;
  from: string;
  path: Path;
  deep: boolean;
  bytes: boolean;
  error?: string;
  diff?: string;
  ms: number;
}

function firstDiff(a: Block[], b: Block[]): string {
  if (a.length !== b.length) return `${a.length} blocks back, ${b.length} wanted`;
  for (let i = 0; i < a.length; i++) {
    const x = JSON.stringify(a[i]),
      y = JSON.stringify(b[i]);
    if (x !== y) return `block ${i}: got ${x.slice(0, 160)} want ${y.slice(0, 160)}`;
  }
  return 'same';
}

export function runAll(): { results: Result[]; precheck: string[]; docResults: { name: string; from: string; ok: boolean; why: string }[] } {
  const precheck: string[] = [];
  const results: Result[] = [];
  for (const [set, cases] of [['normal', normal], ['loose', loose]] as const) {
    for (const c of cases) {
      const v = valid(envelope(c.blocks));
      if (v) precheck.push(`${c.name}: not valid against ev4's schema: ${v}`);
      const want = set === 'normal' ? c.blocks : noteBlocks(c.blocks);
      if (set === 'normal' && JSON.stringify(noteBlocks(c.blocks)) !== JSON.stringify(c.blocks))
        precheck.push(`${c.name}: not in ev4's normal form: ${firstDiff(noteBlocks(c.blocks), c.blocks)}`);
      for (const p of PATHS) {
        const t0 = performance.now();
        let got: Block[] | null = null;
        let error: string | undefined;
        try {
          // a loose case loads the way ev4 loads it: normalised first, then into the editor
          got = through(p, set === 'normal' ? c.blocks : noteBlocks(c.blocks));
        } catch (e) {
          error = (e as Error).message.slice(0, 200);
        }
        const ms = performance.now() - t0;
        const deep = !!got && isDeepStrictEqual(got, want);
        const bytes = !!got && JSON.stringify(got) === JSON.stringify(want);
        results.push({
          set, group: c.group, name: c.name, from: c.from, path: p, deep, bytes, error, ms,
          diff: got && !bytes ? firstDiff(got, want) : undefined,
        });
      }
      // the raw editor on a loose case WITHOUT the ev4 normaliser first: what it would do to a stored loose document
      if (set === 'loose') {
        let got: Block[] | null = null,
          error: string | undefined;
        try {
          got = docToBlocks(DIRECT, blocksToDoc(schema, DIRECT, c.blocks));
        } catch (e) {
          error = (e as Error).message.slice(0, 200);
        }
        results.push({
          set, group: c.group, name: c.name, from: c.from, path: 'unnormalised' as Path,
          deep: !!got && isDeepStrictEqual(got, c.blocks), bytes: !!got && JSON.stringify(got) === JSON.stringify(c.blocks),
          error, ms: 0, diff: got ? firstDiff(got, c.blocks) : undefined,
        });
      }
    }
  }
  // whole documents: the editor holds the blocks, the envelope stays outside it, a save goes through ev4's allowlist
  const docResults = docs.map(({ name, from, doc }) => {
    const v0 = valid(doc);
    const back = exportBlocks(DIRECT, blocksToDoc(schema, DIRECT, noteBlocks(doc.blocks)));
    const saved: NoteDoc = noteDoc(doc, { blocks: back, at: doc.at, source: doc.source });
    const v1 = valid(saved);
    const ok = !v0 && !v1 && JSON.stringify(saved) === JSON.stringify(doc);
    return { name, from, ok, why: ok ? '' : `in: ${v0 || 'valid'}; out: ${v1 || 'valid'}; ${JSON.stringify(saved).slice(0, 300)}` };
  });
  return { results, precheck, docResults };
}
