import {
  buildIndex,
  chunkMaterials,
  likePatterns,
  search,
} from "../domain/index.ts";
import { api, readToken } from "../commands/client.ts";
import type { DocRow } from "./outbox/index.ts";

/** The collections ⌘K looks in, in the order their groups show, with the area that opens each (§ui.palette). */
export const FOUND = [
  { collection: "notes", group: "Notes", area: "notes" },
  { collection: "exams", group: "Exams", area: "library" },
  { collection: "sets", group: "Sets", area: "library" },
  { collection: "weakspots", group: "Weak spots", area: "library" },
] as const;

export type FoundCollection = (typeof FOUND)[number]["collection"];
export type Record_ = Readonly<Record<string, readonly DocRow[]>>;

export interface Found {
  collection: FoundCollection;
  id: string;
  title: string;
}

const MAX_PER_GROUP = 5;

/** The words a document is found by: a note's or exam's or set's title, a weak spot's topic. */
export function titleOf(data: unknown): string {
  const d = (data ?? {}) as { title?: unknown; topic?: unknown };
  const t = typeof d.title === "string" && d.title.trim() ? d.title : d.topic;
  return typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "";
}

/**
 * Matches for what Matt typed, grouped by kind. A SQL-style LIKE narrows (§data.search: any typed word inside the
 * title, so "synth" finds "Synthetic"); domain/search then ranks the candidates.
 */
export function findInRecord(
  rec: Record_,
  query: string,
  max = MAX_PER_GROUP,
): Found[] {
  const q = query.trim();
  const words = likePatterns(q).map((p) => p.slice(1, -1));
  if (!words.length) return [];
  const like = (t: string) => words.some((w) => t.toLowerCase().includes(w));
  const out: Found[] = [];
  for (const { collection } of FOUND) {
    const titled = (rec[collection] ?? [])
      .map((r) => ({ id: r.id, title: titleOf(r.data) }))
      .filter((r) => r.title && like(r.title));
    const score = new Map<string, number>();
    const idx = buildIndex(
      chunkMaterials(
        titled.map((r) => ({
          id: r.id,
          title: r.title,
          kind: collection,
          text: r.title,
        })),
      ),
    );
    for (const h of search(idx, q, { k: titled.length }))
      score.set(h.id, Math.max(score.get(h.id) ?? 0, h.score));
    titled
      .sort(
        (a, b) =>
          (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) ||
          a.title.localeCompare(b.title),
      )
      .slice(0, max)
      .forEach((r) => out.push({ collection, id: r.id, title: r.title }));
  }
  return out;
}

/** "collection/id" of everything in Recently deleted. Tolerant: if the list cannot be read, nothing is hidden. */
export async function readDeletedKeys(): Promise<Set<string>> {
  try {
    const r = await api("deletions", readToken());
    if (!r.ok) return new Set();
    const body = (await r.json()) as { deletions?: unknown };
    const keys = (Array.isArray(body.deletions) ? body.deletions : [])
      .filter(
        (d): d is { collection: string; id: string } =>
          typeof d?.collection === "string" && typeof d?.id === "string",
      )
      .map((d) => `${d.collection}/${d.id}`);
    return new Set(keys);
  } catch {
    return new Set();
  }
}
