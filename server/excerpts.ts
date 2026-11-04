// The passages a practice set may cite (CONTRACT §data.search, §ev.cites): the server finds them in Matt's notes with a
// SQL `LIKE` over docs, ranked by domain/search. A caller never supplies excerpt text; the job cites only these ids.
import {
  buildIndex,
  chunkMaterials,
  likePatterns,
  noteBlocks,
  search,
} from "../domain/index.ts";
import type { D1Like } from "../jobs/index.ts";

const PASSAGES = 12;
const CANDIDATES = 60;

type Row = { id: string; data: string };
export type Excerpt = { id: string; text: string };

/** Matt's note passages that share a word with the objectives; none when there is nothing to search for. */
export async function gatherExcerpts(
  db: D1Like,
  objectives: readonly string[],
): Promise<Excerpt[]> {
  const query = objectives.join(" ");
  const pats = likePatterns(query);
  if (!pats.length) return [];
  const where = pats.map(() => "data LIKE ?").join(" OR ");
  const { results } = await db
    .prepare(
      `SELECT id, data FROM docs WHERE c = 'notes' AND (${where}) LIMIT ${CANDIDATES}`,
    )
    .bind(...pats)
    .all<Row>();
  const materials = results.flatMap((r) => {
    try {
      const d = JSON.parse(r.data) as Record<string, unknown>;
      const text = noteBlocks(d.blocks)
        .map((b) => (b.runs ?? []).map((x) => x.text).join(""))
        .join("\n");
      return [
        {
          id: r.id,
          title: String(d.title ?? ""),
          kind: "note",
          course: null,
          text,
        },
      ];
    } catch {
      return []; // a document that does not parse is skipped, never fixed here
    }
  });
  return search(buildIndex(chunkMaterials(materials)), query, {
    k: PASSAGES,
  }).map((h) => ({ id: h.id, text: h.text }));
}
