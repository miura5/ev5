// The passages a practice set may cite (CONTRACT §data.search, §ev.cites): the server finds them in Matt's notes with a
// SQL `LIKE` over docs, ranked by domain/search. A caller never supplies excerpt text; the job cites only these ids.
import {
  buildIndex,
  chunkMaterials,
  likePatterns,
  noteBlocks,
  parseSet,
  search,
} from "../domain/index.ts";
import type { D1Like } from "../jobs/index.ts";

const PASSAGES = 12;

type Row = { id: string; c: string; data: string };
export type Excerpt = { id: string; text: string };

/**
 * The one gatherer of Matt's documents (§cmd.code-first): a SQL `LIKE` over docs in the named collections, parsed to
 * searchable text and ranked by domain/search. A document in Recently deleted (a deletions row) is never a passage (§delete.soft), and every match
 * is ranked before the top k are kept, so the best match survives however many there are. Notes always; sets only when asked for. Unparsable documents are skipped.
 */
export async function findPassages(
  db: D1Like,
  query: string,
  collections: readonly ("notes" | "sets")[],
  k: number,
) {
  const pats = likePatterns(query);
  if (!pats.length) return [];
  const where = pats.map(() => "data LIKE ?").join(" OR ");
  const marks = collections.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT id, c, data FROM docs WHERE c IN (${marks}) AND (${where}) AND NOT EXISTS (SELECT 1 FROM deletions d WHERE d.c = docs.c AND d.id = docs.id)`,
    )
    .bind(...collections, ...pats)
    .all<Row>();
  const materials = results.flatMap((r) => {
    try {
      const d = JSON.parse(r.data) as Record<string, unknown>;
      if (r.c === "sets") {
        const s = parseSet(d);
        const text = s.items.map((i) => i.stem).join(" ");
        return [
          { id: r.id, title: s.title ?? r.id, kind: "set", course: null, text },
        ];
      }
      const text = noteBlocks(d.blocks)
        .map((b) => (b.runs ?? []).map((x) => x.text).join(""))
        .join("\n");
      return [
        {
          id: r.id,
          title: String(d.title ?? ""),
          kind: "note",
          course: typeof d.course === "string" ? d.course : null,
          text,
        },
      ];
    } catch {
      return []; // a document that does not parse is skipped, never fixed here
    }
  });
  return search(buildIndex(chunkMaterials(materials)), query, { k });
}

/** Matt's note passages that share a word with the objectives; none when there is nothing to search for. */
export async function gatherExcerpts(
  db: D1Like,
  objectives: readonly string[],
): Promise<Excerpt[]> {
  const hits = await findPassages(
    db,
    objectives.join(" "),
    ["notes"],
    PASSAGES,
  );
  return hits.map((h) => ({ id: h.id, text: h.text }));
}
