import type { NoteCollection } from "./types.ts";
import { ApiError, api, readToken } from "../../commands/client.ts";

export interface CollectionsRead {
  collections: NoteCollection[];
  /** Note id to the collection that holds it. */
  members: Map<string, string>;
}

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
  /** The saved copy alone, never the server; `missed()` says a key had none. */
  saved?(): ReadCopyLike & { missed(): boolean };
}

async function get(
  path: string,
  copy?: ReadCopyLike,
): Promise<Record<string, unknown>> {
  const fetcher = async (): Promise<Record<string, unknown>> => {
    const r = await api(path, readToken());
    if (!r.ok) throw new ApiError(r.status); // never kept as the saved copy
    return (await r.json()) as Record<string, unknown>;
  };
  return copy ? copy.read(`notes:${path}`, fetcher) : fetcher();
}

const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

/** Ids of notes in Recently deleted. Tolerant: if the list cannot be read, nothing is hidden. */
export async function readDeletedNoteIds(
  copy?: ReadCopyLike,
): Promise<Set<string>> {
  try {
    const ids = list((await get("deletions", copy)).deletions)
      .filter((d) => d.collection === "notes" && typeof d.id === "string")
      .map((d) => d.id as string);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/** Collections and which notes they hold. Tolerant: a missing table, a refusal or no network reads as none. */
export async function readCollections(
  copy?: ReadCopyLike,
): Promise<CollectionsRead> {
  const out: CollectionsRead = { collections: [], members: new Map() };
  try {
    for (const c of list((await get("collections", copy)).collections))
      if (typeof c.id === "string" && typeof c.title === "string")
        out.collections.push({
          id: c.id,
          title: c.title,
          parentId: typeof c.parentId === "string" ? c.parentId : null,
        });
    if (out.collections.length)
      for (const m of list((await get("memberships", copy)).memberships))
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
