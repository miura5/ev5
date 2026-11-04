import type { NoteCollection } from "./types.ts";
import { api } from "../../commands/client.ts";

export interface CollectionsRead {
  collections: NoteCollection[];
  /** Note id to the collection that holds it. */
  members: Map<string, string>;
}

const token = (): string => {
  try {
    return localStorage.getItem("ev5.token") ?? "";
  } catch {
    return "";
  }
};

async function get(path: string): Promise<Record<string, unknown>> {
  const r = await api(path, token());
  if (!r.ok) return {};
  return (await r.json()) as Record<string, unknown>;
}

const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

/** Collections and which notes they hold. Tolerant: a missing table, a refusal or no network reads as none. */
export async function readCollections(): Promise<CollectionsRead> {
  const out: CollectionsRead = { collections: [], members: new Map() };
  try {
    for (const c of list((await get("collections")).collections))
      if (typeof c.id === "string" && typeof c.title === "string")
        out.collections.push({
          id: c.id,
          title: c.title,
          parentId: typeof c.parentId === "string" ? c.parentId : null,
        });
    if (out.collections.length)
      for (const m of list((await get("memberships")).memberships))
        if (
          m.collection === "notes" &&
          typeof m.id === "string" &&
          typeof m.collectionId === "string"
        )
          out.members.set(m.id, m.collectionId);
  } catch {
    /* offline or not there yet: the notes still show, unfiled */
  }
  return out;
}
