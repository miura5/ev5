// The passages a practice set may cite (CONTRACT §data.search, §ev.cites): the server finds them in Matt's notes with a
// SQL `LIKE` over docs, ranked by domain/search. A caller never supplies excerpt text; the job cites only these ids.
import {
  buildIndex,
  chunkMaterials,
  likePatterns,
  noteDocId,
  parseSet,
  search,
} from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import type { D1Like } from "../jobs/index.ts";

const PASSAGES = 12;

type Row = { id: string; c: string; data: string };
export type Excerpt = { id: string; text: string };

/**
 * The one gatherer of Matt's documents (§cmd.code-first): a SQL `LIKE` over the notes table's text column (and the sets documents), parsed to
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
  // Notes are rows: a `LIKE` over their plain-text column (§data.search). Recently deleted ones are not read (§delete.soft).
  const noteMaterials = collections.includes("notes")
    ? (
        await tablesRepo(db, { clock: () => Date.now() }).noteBook.search(pats)
      ).map((n) => ({
        id: noteDocId(n.id),
        title: n.title,
        kind: "note",
        course: n.course,
        text: n.text,
      }))
    : [];
  // Sets are still documents until their words move.
  const setMaterials = collections.includes("sets")
    ? await setPassages(db, pats)
    : [];
  return search(
    buildIndex(chunkMaterials([...noteMaterials, ...setMaterials])),
    query,
    { k },
  );
}

async function setPassages(db: D1Like, pats: string[]) {
  const where = pats.map(() => "data LIKE ?").join(" OR ");
  const { results } = await db
    .prepare(
      `SELECT id, c, data FROM docs WHERE c = 'sets' AND (${where}) AND NOT EXISTS (SELECT 1 FROM deletions d WHERE d.c = docs.c AND d.id = docs.id)`,
    )
    .bind(...pats)
    .all<Row>();
  return results.flatMap((r) => {
    try {
      const s = parseSet(JSON.parse(r.data));
      const text = s.items.map((i) => i.stem).join(" ");
      return [
        { id: r.id, title: s.title ?? r.id, kind: "set", course: null, text },
      ];
    } catch {
      return []; // a document that does not parse is skipped, never fixed here
    }
  });
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
