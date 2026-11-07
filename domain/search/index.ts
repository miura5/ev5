import type { Passage } from './chunk.ts';
import { tokenize } from './tokens.ts';
export { chunkMaterials, type Material, type Passage } from './chunk.ts';
export { likePatterns } from './tokens.ts';

// Passage scoring, ported from ev4 core/library.mjs (libraryIndex, searchLibrary): BM25, a small title bonus, a
// bonus for adjacent query words, a reward for covering more of the query, at most two passages per file.
// §data.search: no FTS5; a SQL `LIKE` (likePatterns) narrows the candidates and this ranks them. Pure, no IO.
type Doc = {
  p: Passage;
  tf: Map<string, number>;
  pairs: Set<string>;
  len: number;
  title: Set<string>;
};
export type Index = { docs: Doc[]; df: Map<string, number>; avg: number };
type SearchOptions = {
  collections?: ReadonlySet<string>;
  kind?: string;
  id?: string;
  k?: number;
  hitChars?: number;
};
export type Hit = Passage & { score: number };

const K1 = 1.2;
const B = 0.75;

/** An index over passages (build once per page open or run). */
export function buildIndex(passages: Passage[]): Index {
  const docs = passages.map((p): Doc => {
    const t = tokenize(`${p.title} ${p.text}`);
    const tf = new Map<string, number>();
    const pairs = new Set<string>();
    t.forEach((w, i) => {
      tf.set(w, (tf.get(w) ?? 0) + 1);
      if (i) pairs.add(`${t[i - 1]} ${w}`);
    });
    return { p, tf, pairs, len: t.length, title: new Set(tokenize(p.title)) };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  return {
    docs,
    df,
    avg: docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length),
  };
}

/** The best passages for a query. `collections` keeps only passages of those collections (a passage in none stays). */
export function search(index: Index, query: string, o: SearchOptions = {}): Hit[] {
  const seq = tokenize(query);
  const q = [...new Set(seq)];
  if (!q.length) return [];
  const bigrams = [...new Set(seq.slice(1).map((w, i) => `${seq[i]} ${w}`))];
  const n = index.docs.length;
  const idf = (w: string) => {
    const f = index.df.get(w) ?? 0;
    return Math.log(1 + (n - f + 0.5) / (f + 0.5));
  };
  const scored: { s: number; d: Doc }[] = [];
  for (const d of index.docs) {
    const p = d.p;
    if (o.collections && p.collection_id && !o.collections.has(p.collection_id)) continue;
    if ((o.kind && p.kind !== o.kind) || (o.id && p.id !== o.id)) continue;
    let s = 0;
    let hit = 0;
    for (const w of q) {
      const f = d.tf.get(w);
      if (!f) continue;
      hit++;
      s +=
        (idf(w) * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * d.len) / index.avg)) + (d.title.has(w) ? idf(w) * 0.5 : 0);
    }
    if (!hit) continue;
    for (const b of bigrams) {
      if (!d.pairs.has(b)) continue;
      const [x, y] = b.split(' ') as [string, string];
      s += 0.75 * (idf(x) + idf(y));
    }
    scored.push({ s: s * (0.4 + (0.6 * hit) / q.length), d });
  }
  scored.sort((a, b) => b.s - a.s);
  const per = new Map<string, number>();
  const out: Hit[] = [];
  for (const { s, d } of scored) {
    const c = per.get(d.p.id) ?? 0;
    if (c >= 2) continue;
    per.set(d.p.id, c + 1);
    out.push({
      ...d.p,
      text: d.p.text.slice(0, o.hitChars ?? 700),
      score: Math.round(s * 100) / 100,
    });
    if (out.length >= (o.k ?? 6)) break;
  }
  return out;
}
