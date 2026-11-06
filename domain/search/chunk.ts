// Your material cut into passages by page or slide mark, each keeping the page it came from and its collection.
export type Material = {
  id: string;
  title?: string;
  collection_id?: string | null;
  kind?: string;
  text: string;
};
export type Passage = {
  id: string;
  title: string;
  collection_id: string | null;
  kind: string;
  page: number | null;
  unit: 'page' | 'slide' | null;
  text: string;
};

const CHUNK_CHARS = 900;
const PAGE_SPLIT = /(?=\[(?:p|s|Page |Slide )\d+\])/;
const PAGE_MARK = /^\[(p|s|Page |Slide )(\d+)\]\s*/;

/** Every searchable passage: per page or slide, then about `chunkChars` long, with the page it came from. */
export function chunkMaterials(materials: Material[], chunkChars = CHUNK_CHARS): Passage[] {
  const out: Passage[] = [];
  for (const m of materials) {
    if (!m.text) continue;
    for (const part of m.text.split(PAGE_SPLIT)) {
      const mk = PAGE_MARK.exec(part);
      const page = mk ? Number(mk[2]) : null;
      const unit = mk ? (/^s/i.test(mk[1]!) ? 'slide' : 'page') : null;
      const body = part.replace(PAGE_MARK, '').replace(/\s+/g, ' ').trim();
      if (!body) continue;
      let buf = '';
      const push = () => {
        if (buf.trim())
          out.push({
            id: m.id,
            title: m.title || m.id,
            collection_id: m.collection_id ?? null,
            kind: m.kind ?? 'note',
            page,
            unit,
            text: buf.trim(),
          });
        buf = '';
      };
      for (const s of body.match(/[^.!?•]+[.!?•]*\s*/g) ?? [body]) {
        if (buf && buf.length + s.length > chunkChars) push();
        buf += s;
        if (buf.length > chunkChars * 1.6) push();
      }
      push();
    }
  }
  return out;
}

/** How a passage is named: "a source file, p. 12" or "Chapter 7 ppt, slide 4". */
export const cite = (p: Pick<Passage, 'id' | 'title' | 'page' | 'unit'>): string =>
  (p.title || p.id).replace(/\.(pdf|docx|pptx)$/i, '') +
  (p.page ? (p.unit === 'slide' ? ', slide ' : ', p. ') + p.page : '');
