import { noteRowId, shortDay } from "../../domain/index.ts";
import type { CollectionEntry } from "./Collection.view.tsx";

/** The read routes' rows (server/collection-routes.ts), restated: areas never import the server. */
export interface WireCollection {
  id: string;
  title: string;
  parentId: string | null;
  pos: number;
  v: number;
}
export interface WireMembership {
  collection: string;
  id: string;
  collectionId: string;
  at: number;
  v: number;
}

export interface WirePin {
  collection: string;
  id: string;
  pos: number;
  at: number;
}

/** What a title line needs from a row (read through the row routes): its name, its kind when it has one, its time. */
export interface NamedRow {
  id: string;
  title?: string;
  kind?: string;
  at?: number;
}

/** Rows by collection name, as read for the members' collections. */
export type DocsByCollection = Record<string, readonly NamedRow[]>;

export interface CollectionData {
  id: string;
  /** The version it was read at: rename is pinned to it (§data.protocol). */
  v: number;
  title: string;
  parent?: string;
  parentId?: string;
  nested: CollectionEntry[];
  items: CollectionEntry[];
  /** Every collection, for the Move picker. */
  all: { id: string; title: string }[];
}

/** The row a member or pin names. A note's row id is `note_<id>` (GET /notes) while memberships and pins name it by the bare id, so both forms match. */
const rowOf = (
  docs: DocsByCollection,
  collection: string,
  id: string,
): NamedRow | undefined =>
  docs[collection]?.find(
    (d) => d.id === id || (collection === "notes" && d.id === noteRowId(id)),
  );

/** The pinned items (GET /pins, already by pos then newest first), named from their docs. */
export function mapPins(
  pins: readonly WirePin[],
  docs: DocsByCollection = {},
): CollectionEntry[] {
  return pins.map((p) => ({
    id: p.id,
    type: TYPES[p.collection] ?? "note",
    title: docTitle(rowOf(docs, p.collection, p.id)),
    meta: kindLine(p.collection, rowOf(docs, p.collection, p.id)),
    to: openPath(p.collection, p.id),
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
  sets: "questions",
};

/** The kind in words, for the row's second line. */
const KINDS: Record<string, string> = {
  notes: "Note",
  cards: "Cards",
  questions: "Questions",
  steps: "Steps",
  plans: "Plan",
  jobs: "Job",
  goals: "Date",
  sets: "Set",
  weakspots: "Weak spot",
};

/** What kind of item it is: every date reads "Date", with its own kind (exam, other) after it when it has one. */
function kindLine(collection: string, doc: NamedRow | undefined): string {
  const label = KINDS[collection] ?? collection;
  const kind = collection === "goals" ? doc?.kind : undefined;
  return kind ? `${label} · ${kind}` : label;
}

/** Where Open goes: the area that holds the kind, naming the item (?open=), as the palette does. */
export function openPath(kind: string, id: string): string | undefined {
  const q = encodeURIComponent(id);
  if (kind === "notes") return `/notes?open=${q}`;
  if (kind === "sets" || kind === "weakspots") return `/library?open=${q}`;
  if (kind === "goals") return "/today";
  return undefined;
}

/** The item's own name; "Untitled" when it has none (never its id). */
export const docTitle = (d: NamedRow | undefined): string =>
  d?.title?.trim() || "Untitled";

/** "Nov 3", Central time (§time), from epoch ms. */
export const shortDate = (ms: number): string => shortDay(ms);

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
    id: pick.id,
    v: pick.v,
    title: pick.title,
    parent,
    parentId: pick.parentId ?? undefined,
    all: byPos.map((c) => ({ id: c.id, title: c.title })),
    nested: byPos
      .filter((c) => c.parentId === pick.id)
      .map((c) => ({ id: c.id, v: c.v, type: "collection", title: c.title })),
    items: memberships
      .filter((m) => m.collectionId === pick.id)
      .sort((a, b) => b.at - a.at)
      .map((m) => {
        const doc = rowOf(docs, m.collection, m.id);
        return {
          id: m.id,
          v: m.v,
          type: TYPES[m.collection] ?? "note",
          title: docTitle(doc),
          meta: `${kindLine(m.collection, doc)} · ${shortDate(doc?.at ?? m.at)}`,
          to: openPath(m.collection, m.id),
        };
      }),
  };
}
