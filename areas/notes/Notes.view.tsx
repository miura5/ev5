import { useState } from "react";
import { Button, Glyph, Row } from "../../kit/index.ts";
import { RowActions, type RowAction } from "./parts/RowActions.tsx";
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
  /** The read failed: the list is unknown, so it does not say "No notes yet". */
  failed?: boolean;
  onOpenNote?: (id: string) => void;
  onNewNote?: (collectionId?: string) => void;
  onNewCollection?: () => void;
  /** A row's menu pick on Recent and in the By-collection tree. */
  onRowAction?: (id: string, action: RowAction) => void;
  /** Move picked a collection for a note (item.move). */
  onMove?: (id: string, collectionId: string) => void;
}

/** Notes home: the three most recent notes, then every collection as a folding row. */
export function NotesView({
  notes,
  collections,
  initialOpen = [],
  failed = false,
  onOpenNote,
  onNewNote,
  onNewCollection,
  onRowAction,
  onMove,
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
        {notes.length === 0 && !failed ? (
          <span className="ev-notes-meta">
            No notes yet. Press C to write one.
          </span>
        ) : null}
        {notes.slice(0, 3).map((n) => (
          <RowActions
            key={n.id}
            title={n.title}
            targets={collections}
            current={n.collectionId}
            onAction={onRowAction ? (a) => onRowAction(n.id, a) : undefined}
            onMove={onMove ? (c) => onMove(n.id, c) : undefined}
          >
            <Row
              glyph={<Glyph type="note" />}
              title={n.title}
              meta={n.preview}
              value={n.when}
              onOpen={() => onOpenNote?.(n.id)}
            />
          </RowActions>
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
          onRowAction={onRowAction}
          onMove={onMove}
        />
      </section>
    </section>
  );
}
