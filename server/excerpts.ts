// The passages a practice set may cite (CONTRACT §data.search, §ev.cites): the server finds them in the user's notes (a SQL
// `LIKE` over the notes table, or the notes of the collection or note the scope names), ranked by domain/search. A caller
// never supplies excerpt text; the job cites only these ids.
import {
  buildIndex,
  chunkMaterials,
  likePatterns,
  noteDocId,
  noteRowId,
  search,
} from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import type { D1Like } from "../jobs/index.ts";

const PASSAGES = 12;

// A passage's text is cut as search cuts a hit, so a source's passages read the same as ranked ones.
const HIT_CHARS = 700;

export type Excerpt = { id: string; text: string };
/** What a practice set may be pointed at: one collection's notes, or one note (by its note id). */
export type ExcerptSource = { kind: "collection" | "note"; id: string };

/**
 * The one gatherer of the user's documents (§cmd.code-first): a SQL `LIKE` over the notes table's text column (and the stems of the sets' items), parsed to
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
        text: n.text,
        collection_id: n.collection_id,
      }))
    : [];
  // Sets are rows (§data.tables): the stems of their live items.
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
  const found = await tablesRepo(db, {
    clock: () => Date.now(),
  }).setBook.search(pats);
  return found.map((s) => ({
    id: s.id,
    title: s.title || s.id,
    kind: "set",
    text: s.stems.join(" "),
  }));
}

/** The live notes a source names: the one note, or every note whose row sits in the collection (§data.tables). */
async function sourceNotes(db: D1Like, source: ExcerptSource) {
  const t = tablesRepo(db, { clock: () => Date.now() });
  const rows =
    source.kind === "note"
      ? [await t.noteBook.get(noteRowId(source.id))].flatMap((n) =>
          n ? [n] : [],
        )
      : await t.notes.list({ where: { collection_id: source.id } });
  return rows.map((n) => ({
    id: noteDocId(n.id),
    title: n.title,
    kind: "note",
    collection_id: n.collection_id,
    text: n.text,
  }));
}

/** A source's passages in order when nothing ranks them: at most two per note, so one long note does not crowd out the rest. */
function firstPassages(passages: { id: string; text: string }[]) {
  const per = new Map<string, number>();
  return passages
    .filter((p) => {
      const n = per.get(p.id) ?? 0;
      per.set(p.id, n + 1);
      return n < 2;
    })
    .slice(0, PASSAGES)
    .map((p) => ({ id: p.id, text: p.text.slice(0, HIT_CHARS) }));
}

/**
 * The excerpts for a practice set. With a source, only its notes: ranked by the objectives when they match, else its
 * passages in order, so a source alone is enough. Without one, the user's note passages that share a word with the
 * objectives; none when there is nothing to search for.
 */
export async function gatherExcerpts(
  db: D1Like,
  objectives: readonly string[],
  source?: ExcerptSource,
): Promise<Excerpt[]> {
  const query = objectives.join(" ");
  if (source) {
    const passages = chunkMaterials(await sourceNotes(db, source));
    const ranked = search(buildIndex(passages), query, { k: PASSAGES });
    return ranked.length
      ? ranked.map((h) => ({ id: h.id, text: h.text }))
      : firstPassages(passages);
  }
  const hits = await findPassages(db, query, ["notes"], PASSAGES);
  return hits.map((h) => ({ id: h.id, text: h.text }));
}
