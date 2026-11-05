import { useCallback, useEffect, useState } from "react";
import {
  newNoteId,
  noteDoc,
  parseNote,
  type Block,
  type Note,
} from "../../domain/index.ts";
import {
  readCollections,
  readDeletedNoteIds,
  type CollectionsRead,
  type ReadCopyLike,
} from "./collections.ts";
import type { NoteCollection } from "./types.ts";
import { failureSentence } from "../../commands/client.ts";

/** What the shell hands the screen (shell/services.ts), restated: areas never import the shell. */
export interface NotesServices {
  readCopy?: ReadCopyLike;
  docs: {
    list(
      collection: string,
    ): Promise<{ id: string; v: number; at: number; data: unknown }[]>;
  };
  outbox: {
    queueNote(id: string, doc: Note, base: number | null): Promise<unknown>;
    replay(): Promise<{
      stopped?: "offline" | "auth" | "busy";
      refused: string[];
    }>;
  };
}

export interface LoadedNote {
  id: string;
  /** The version it was read at; the next save is pinned to it. */
  v: number;
  note: Note;
}

export type SaveState = "saved" | "saving" | "not saved";

export interface NotesState {
  notes: LoadedNote[];
  error?: string;
  saveState: SaveState;
  collections: NoteCollection[];
  /** Note id to its collection id. */
  members: ReadonlyMap<string, string>;
  /** Makes an empty note, queues it, and returns its id. */
  createNote: () => Promise<string | undefined>;
  /** Saves edited blocks through the outbox (offline-safe); the title follows the first heading. */
  saveBlocks: (id: string, blocks: Block[]) => Promise<void>;
  /** Saves a new first-heading text through the outbox: it works offline and replays when the connection returns. */
  saveTitle: (id: string, title: string) => Promise<void>;
}

/** Who a note save names in `source`: starts with "v5", as ev4's record requires of v5's writes (validateWrite). */
export const NOTE_SOURCE = "v5/notes";

/** A note with its title set: the first h1 gets the new words (one is added if none), everything else is kept. */
export function withTitle(prev: Note, title: string, at: string): Note {
  const words = title.replace(/\s+/g, " ").trim();
  const head = { type: "h1" as const, runs: [{ text: words }] };
  const i = prev.blocks.findIndex((b) => b.type === "h1");
  const blocks =
    i < 0
      ? [head, ...prev.blocks]
      : prev.blocks.map((b, k) => (k === i ? { ...b, runs: head.runs } : b));
  return { ...prev, title: words, blocks, at, source: NOTE_SOURCE, editedAt: at };
}

/** Reads the notes collection, replays anything waiting first, and saves titles through the outbox. */
export function useNotes(services?: NotesServices): NotesState {
  const [notes, setNotes] = useState<LoadedNote[]>([]);
  const [error, setError] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [cols, setCols] = useState<CollectionsRead>({
    collections: [],
    members: new Map(),
  });

  const load = useCallback(async () => {
    if (!services) return;
    try {
      await services.outbox.replay();
      const rows = await services.docs.list("notes");
      const gone = await readDeletedNoteIds(services.readCopy);
      setNotes(
        rows.flatMap((r) => {
          if (gone.has(r.id)) return []; // in Recently deleted: out of Notes until restored
          try {
            return [{ id: r.id, v: r.v, note: parseNote(r.data) }];
          } catch {
            return []; // a document that is not a note stays out of the list
          }
        }),
      );
      setError(undefined);
      const read = await readCollections(services.readCopy);
      setCols({
        ...read,
        members: new Map([...read.members].filter(([id]) => !gone.has(id))),
      });
    } catch (e) {
      setError(failureSentence(e)); // never the server's own words
    }
  }, [services]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Shows the document now, queues it, and tries to send; the state says whether it got there. */
  const persist = useCallback(
    async (id: string, doc: Note, base: number | null) => {
      if (!services) return;
      setSaveState("saving");
      setNotes((all) =>
        all.some((n) => n.id === id)
          ? all.map((n) => (n.id === id ? { ...n, note: doc } : n))
          : [{ id, v: 0, note: doc }, ...all],
      );
      await services.outbox.queueNote(id, doc, base);
      const res = await services.outbox.replay();
      if (res.stopped || res.refused.length)
        return void setSaveState("not saved");
      setSaveState("saved");
      await load();
    },
    [services, load],
  );

  const saveBlocks = useCallback(
    async (id: string, blocks: Block[]) => {
      const cur = notes.find((n) => n.id === id);
      if (!cur) return;
      const at = new Date().toISOString();
      const doc = noteDoc(cur.note, { blocks, at, source: NOTE_SOURCE });
      await persist(id, doc, cur.v || null);
    },
    [notes, persist],
  );

  const saveTitle = useCallback(
    async (id: string, title: string) => {
      const cur = notes.find((n) => n.id === id);
      if (!cur || !title.trim()) return;
      await persist(
        id,
        withTitle(cur.note, title, new Date().toISOString()),
        cur.v || null,
      );
    },
    [notes, persist],
  );

  const createNote = useCallback(async () => {
    if (!services) return undefined;
    const at = new Date().toISOString();
    const id = newNoteId(at, crypto.randomUUID());
    const doc = noteDoc(null, {
      blocks: [
        { type: "h1", runs: [{ text: "Untitled" }] },
        { type: "p", runs: [] },
      ],
      at,
      source: NOTE_SOURCE,
    });
    await persist(id, doc, null);
    return id;
  }, [services, persist]);

  return {
    notes,
    error,
    saveState,
    collections: cols.collections,
    members: cols.members,
    createNote,
    saveBlocks,
    saveTitle,
  };
}
