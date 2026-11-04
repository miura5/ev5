import type { CollectionEntry } from "./Collection.view.tsx";

/** The read routes' rows (server/collection-routes.ts), restated: areas never import the server. */
export interface WireCollection {
  id: string;
  title: string;
  parentId: string | null;
  pos: number;
}
export interface WireMembership {
  collection: string;
  id: string;
  collectionId: string;
  at: number;
}

export interface WirePin {
  collection: string;
  id: string;
  pos: number;
  at: number;
}

/** A docs row (GET /docs?collection=c): the item a membership points at. */
export interface WireDoc {
  id: string;
  at?: number;
  data?: unknown;
}
/** Docs by collection name, as read for the members' collections. */
export type DocsByCollection = Record<string, readonly WireDoc[]>;

export interface CollectionData {
  title: string;
  parent?: string;
  parentId?: string;
  nested: CollectionEntry[];
  items: CollectionEntry[];
}

/** The pinned items (GET /pins, already by pos then newest first), named from their docs. */
export function mapPins(
  pins: readonly WirePin[],
  docs: DocsByCollection = {},
): CollectionEntry[] {
  return pins.map((p) => ({
    id: p.id,
    type: TYPES[p.collection] ?? "note",
    title: docTitle(
      docs[p.collection]?.find((d) => d.id === p.id),
      p.id,
    ),
    meta: p.collection,
  }));
}

const TYPES: Record<string, CollectionEntry["type"]> = {
  notes: "note",
  cards: "cards",
  questions: "questions",
  steps: "steps",
  plans: "plan",
  jobs: "job",
  goals: "date",
};

const field = (d: unknown, k: string): string | undefined => {
  const v =
    d && typeof d === "object" ? (d as Record<string, unknown>)[k] : undefined;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

/** The item's own name: title, else name, else text; the id only when the item is gone or unnamed. */
export const docTitle = (d: WireDoc | undefined, fallback: string): string =>
  field(d?.data, "title") ??
  field(d?.data, "name") ??
  field(d?.data, "text") ??
  fallback;

/** "Nov 3", Central time (§time), from epoch ms. */
export const shortDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });

/** Shows the collection `id`, else the first top-level one (by pos), with its sub-collections and members; none gives undefined (empty state). */
export function mapCollection(
  collections: readonly WireCollection[],
  memberships: readonly WireMembership[],
  id?: string,
  docs: DocsByCollection = {},
): CollectionData | undefined {
  const byPos = [...collections].sort(
    (a, b) => a.pos - b.pos || a.id.localeCompare(b.id),
  );
  const pick =
    (id ? byPos.find((c) => c.id === id) : undefined) ??
    byPos.find((c) => c.parentId === null) ??
    byPos[0];
  if (!pick) return undefined;
  const parent = pick.parentId
    ? byPos.find((c) => c.id === pick.parentId)?.title
    : undefined;
  return {
    title: pick.title,
    parent,
    parentId: pick.parentId ?? undefined,
    nested: byPos
      .filter((c) => c.parentId === pick.id)
      .map((c) => ({ id: c.id, type: "collection", title: c.title })),
    items: memberships
      .filter((m) => m.collectionId === pick.id)
      .sort((a, b) => b.at - a.at)
      .map((m) => {
        const doc = docs[m.collection]?.find((d) => d.id === m.id);
        return {
          id: m.id,
          type: TYPES[m.collection] ?? "note",
          title: docTitle(doc, m.id),
          meta: `${m.collection} · ${shortDate(doc?.at ?? m.at)}`,
        };
      }),
  };
}
