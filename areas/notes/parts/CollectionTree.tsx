import { Button, Glyph, Row } from "../../../kit/index.ts";
import { RowActions, type RowAction } from "./RowActions.tsx";
import type { NoteCollection, NoteSummary } from "../types.ts";

export interface CollectionTreeProps {
  collections: readonly NoteCollection[];
  notes: readonly NoteSummary[];
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onOpenNote?: (id: string) => void;
  onNewNoteIn?: (collectionId: string) => void;
  onRowAction?: (id: string, action: RowAction) => void;
  onMove?: (id: string, collectionId: string) => void;
}

const NONE = "none";

function total(
  id: string,
  cols: readonly NoteCollection[],
  notes: readonly NoteSummary[],
): number {
  const ids = new Set([
    id,
    ...cols.filter((c) => c.parentId === id).map((c) => c.id),
  ]);
  return notes.filter((n) => n.collectionId && ids.has(n.collectionId)).length;
}

/** Collections as folding rows, nested one level, each opening to its notes. */
export function CollectionTree({
  collections,
  notes,
  open,
  onToggle,
  onOpenNote,
  onNewNoteIn,
  onRowAction,
  onMove,
}: CollectionTreeProps) {
  const own = (id: string | null) => notes.filter((n) => n.collectionId === id);
  const noteRows = (id: string | null, level: 0 | 1) =>
    own(id).map((n) => (
      <RowActions
        key={n.id}
        title={n.title}
        targets={collections}
        current={n.collectionId}
        onAction={onRowAction ? (a) => onRowAction(n.id, a) : undefined}
        onMove={onMove ? (c) => onMove(n.id, c) : undefined}
      >
        <Row
          level={level}
          glyph={<Glyph type="note" />}
          title={n.title}
          meta={n.preview}
          value={n.when}
          onOpen={() => onOpenNote?.(n.id)}
        />
      </RowActions>
    ));
  const fold = (
    id: string,
    title: string,
    level: 0 | 1,
    count: number,
    withNew: boolean,
  ) => (
    <div data-key={id}>
      <Row
        level={level}
        fold={{ open: open.has(id), onToggle: () => onToggle(id) }}
        glyph={<Glyph type={id === NONE ? "note" : "collection"} />}
        title={title}
        value={`${count} ${count === 1 ? "note" : "notes"}`}
        actions={
          withNew ? (
            <span onClick={(e) => e.stopPropagation()}>
              <Button
                kind="text"
                aria-label={`New note in ${title}`}
                onClick={() => onNewNoteIn?.(id)}
              >
                New note
              </Button>
            </span>
          ) : undefined
        }
      />
    </div>
  );
  const tops = collections.filter((c) => !c.parentId);
  const loose = own(null).length;
  return (
    <div>
      {tops.map((c) => (
        <div key={c.id}>
          {fold(c.id, c.title, 0, total(c.id, collections, notes), true)}
          {open.has(c.id) ? (
            <>
              {collections
                .filter((k) => k.parentId === c.id)
                .map((k) => (
                  <div key={k.id}>
                    {fold(k.id, k.title, 1, own(k.id).length, true)}
                    {open.has(k.id) ? noteRows(k.id, 1) : null}
                  </div>
                ))}
              {noteRows(c.id, 1)}
            </>
          ) : null}
        </div>
      ))}
      {loose ? (
        <div>
          {fold(NONE, "No collection", 0, loose, false)}
          {open.has(NONE) ? noteRows(null, 1) : null}
        </div>
      ) : null}
    </div>
  );
}
