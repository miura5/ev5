import { useState } from "react";
import { Button, Glyph, Row } from "../../kit/index.ts";
import { CollectionTree } from "./parts/CollectionTree.tsx";
import type { NoteCollection, NoteSummary } from "./types.ts";
import "./notes.css";

export type { NoteCollection, NoteSummary } from "./types.ts";

export interface NotesViewProps {
  /** Newest first. */
  notes: readonly NoteSummary[];
  collections: readonly NoteCollection[];
  /** Ids of collections shown open at first. */
  initialOpen?: readonly string[];
  onOpenNote?: (id: string) => void;
  onNewNote?: (collectionId?: string) => void;
  onNewCollection?: () => void;
}

/** Notes home: the three most recent notes, then every collection as a folding row. */
export function NotesView({
  notes,
  collections,
  initialOpen = [],
  onOpenNote,
  onNewNote,
  onNewCollection,
}: NotesViewProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(initialOpen));
  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <section className="ev-notes" aria-label="Notes" data-area="notes">
      <div className="ev-notes-head">
        <h1 className="ev-notes-title">Notes</h1>
        <span className="ev-notes-meta">what you write</span>
        <span className="ev-notes-grow" />
        <Button kind="text" onClick={onNewCollection}>
          New collection
        </Button>
        <Button kind="primary" hint="C" onClick={() => onNewNote?.()}>
          New note
        </Button>
      </div>
      <section className="ev-notes-sec" aria-label="Recent">
        <h2 className="ev-notes-label">Recent</h2>
        {notes.length === 0 ? (
          <span className="ev-notes-meta">
            No notes yet. Press C to write one.
          </span>
        ) : null}
        {notes.slice(0, 3).map((n) => (
          <div className="ev-notes-line" key={n.id}>
            <Row
              glyph={<Glyph type="note" />}
              title={n.title}
              meta={n.preview}
              value={n.when}
              onOpen={() => onOpenNote?.(n.id)}
            />
          </div>
        ))}
      </section>
      <section className="ev-notes-sec" aria-label="By collection">
        <div className="ev-notes-sec-head">
          <h2 className="ev-notes-label">By collection</h2>
          <span className="ev-notes-grow" />
          <span className="ev-notes-meta">← → fold</span>
        </div>
        <CollectionTree
          collections={collections}
          notes={notes}
          open={open}
          onToggle={toggle}
          onOpenNote={onOpenNote}
          onNewNoteIn={(id) => onNewNote?.(id)}
        />
      </section>
    </section>
  );
}
