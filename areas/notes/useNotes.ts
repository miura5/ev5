import { useCallback, useEffect, useState } from "react";
import { parseNote, type Note } from "../../domain/index.ts";

/** What the shell hands the screen (shell/services.ts), restated: areas never import the shell. */
export interface NotesServices {
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
  /** Saves a new first-heading text through the outbox: it works offline and replays when the connection returns. */
  saveTitle: (id: string, title: string) => Promise<void>;
}

/** A note with its title set: the first h1 gets the new words (one is added if none), everything else is kept. */
export function withTitle(prev: Note, title: string, at: string): Note {
  const words = title.replace(/\s+/g, " ").trim();
  const head = { type: "h1" as const, runs: [{ text: words }] };
  const i = prev.blocks.findIndex((b) => b.type === "h1");
  const blocks =
    i < 0
      ? [head, ...prev.blocks]
      : prev.blocks.map((b, k) => (k === i ? { ...b, runs: head.runs } : b));
  return { ...prev, title: words, blocks, at, source: "E.V. 5", editedAt: at };
}

/** Reads the notes collection, replays anything waiting first, and saves titles through the outbox. */
export function useNotes(services?: NotesServices): NotesState {
  const [notes, setNotes] = useState<LoadedNote[]>([]);
  const [error, setError] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const load = useCallback(async () => {
    if (!services) return;
    try {
      await services.outbox.replay();
      const rows = await services.docs.list("notes");
      setNotes(
        rows.flatMap((r) => {
          try {
            return [{ id: r.id, v: r.v, note: parseNote(r.data) }];
          } catch {
            return []; // a document that is not a note stays out of the list
          }
        }),
      );
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notes could not load.");
    }
  }, [services]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveTitle = useCallback(
    async (id: string, title: string) => {
      const cur = notes.find((n) => n.id === id);
      if (!services || !cur || !title.trim()) return;
      const doc = withTitle(cur.note, title, new Date().toISOString());
      setSaveState("saving");
      setNotes((all) =>
        all.map((n) => (n.id === id ? { ...n, note: doc } : n)),
      );
      await services.outbox.queueNote(id, doc, cur.v);
      const res = await services.outbox.replay();
      if (res.stopped || res.refused.length)
        return void setSaveState("not saved");
      setSaveState("saved");
      await load();
    },
    [services, notes, load],
  );

  return { notes, error, saveState, saveTitle };
}
