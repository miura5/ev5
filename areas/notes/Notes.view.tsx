import { useState } from "react";
import { Button, Empty, Glyph, Page, Row, Section } from "../../kit/index.ts";
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
  /** The first read is still in flight: the list is unknown, so it says "Loading…", never "No notes yet". */
  loading?: boolean;
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
  loading = false,
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
    <Page
      title="Notes"
      meta="what you write"
      actions={
        <>
          <Button kind="text" onClick={onNewCollection}>
            New collection
          </Button>
          <Button kind="primary" hint="C" onClick={() => onNewNote?.()}>
            New note
          </Button>
        </>
      }
    >
      <Section label="Recent">
        {notes.length === 0 && loading && !failed ? (
          <Empty line="Loading…" />
        ) : null}
        {notes.length === 0 && !loading && !failed ? (
          <Empty line="No notes yet. Press C to write one." />
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
      </Section>
      <Section label="By collection" count="← → fold">
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
      </Section>
    </Page>
  );
}
