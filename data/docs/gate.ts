// The write and read gate for the docs table (§data.gate): what a stored document must pass on the way in (the Worker's
// note check, then the kind's domain parser, then the title rule) and on the way out (parsed again; a bad row is
// reported and left out). Worker-safe: no node:fs. The size budget and the protocol (v, at, if_version) are in repo.ts.
import type { Json } from "../compat/canonical.ts";
import type { StoredDoc, WriteProblem } from "../compat/protocol.ts";
import type { D1Like } from "./d1.ts";
import { DOMAIN_PARSERS } from "./parsers.ts";
import { workerNoteProblem } from "./worker-check.ts";

/** The kinds whose documents carry a `title` a rename may change; every other kind refuses one. */
export const TITLED: readonly string[] = ["exams", "notes", "sets"];

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Why this document does not parse as its kind (a kind with no domain parser always passes), else null. */
export function parseProblem(
  c: string,
  id: string,
  doc: unknown,
): string | null {
  const parse = Object.hasOwn(DOMAIN_PARSERS, c)
    ? DOMAIN_PARSERS[c]
    : undefined;
  if (!parse) return null;
  try {
    parse(doc);
    return null;
  } catch (e) {
    return `${c}/${id} does not parse: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Why a title cannot be set on this kind, else null. */
export function titleProblem(c: string, id: string): string | null {
  return TITLED.includes(c) ? null : `${c}/${id} has no title to change`;
}

/** The write rules of every docs write: the note check, the kind's parser, and no title on a kind without one. */
export const gateProblem: WriteProblem = (c, id, doc: Json, prev) =>
  workerNoteProblem(c, id, doc, prev) ??
  parseProblem(c, id, doc) ??
  (Object.hasOwn(DOMAIN_PARSERS, c) && isObj(doc) && "title" in doc
    ? titleProblem(c, id)
    : null);

/** The ids in `c` with a deletions row (§delete.soft: the documents stay, reads hide them). */
export async function deletedIds(db: D1Like, c: string): Promise<Set<string>> {
  try {
    const { results } = await db
      .prepare("SELECT c, id, at FROM deletions WHERE c = ?")
      .bind(c)
      .all<{ id: string }>();
    return new Set(results.map((d) => d.id));
  } catch (e) {
    // Every real database has the table (migrations); only a test fixture that builds `docs` alone lacks it.
    if (/no such table: deletions/.test(String(e))) return new Set();
    throw e;
  }
}

export interface Row {
  c: string;
  id: string;
  data: string;
  at: number;
  v: number;
}

export const stored = (r: Row): StoredDoc => ({
  c: r.c,
  id: r.id,
  text: r.data,
  data: JSON.parse(r.data) as Json,
  at: r.at,
  v: r.v,
});

/** A stored row parsed as its kind; a bad one is reported through `onBad` and comes back null. */
export function readRow(
  r: Row,
  onBad: (b: { collection: string; doc_id: string; reason: string }) => void,
): StoredDoc | null {
  let doc: StoredDoc;
  try {
    doc = stored(r);
  } catch {
    onBad({ collection: r.c, doc_id: r.id, reason: "not JSON" });
    return null;
  }
  const reason = parseProblem(r.c, r.id, doc.data);
  if (reason) onBad({ collection: r.c, doc_id: r.id, reason });
  return reason ? null : doc;
}
