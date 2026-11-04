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

export interface CollectionData {
  title: string;
  parent?: string;
  parentId?: string;
  nested: CollectionEntry[];
  items: CollectionEntry[];
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

/** Shows the collection `id`, else the first top-level one (by pos), with its sub-collections and members; none gives undefined (empty state). */
export function mapCollection(
  collections: readonly WireCollection[],
  memberships: readonly WireMembership[],
  id?: string,
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
      .map((m) => ({
        id: m.id,
        type: TYPES[m.collection] ?? "note",
        title: m.id,
        meta: m.collection,
      })),
  };
}
