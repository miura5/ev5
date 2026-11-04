import { Button, Glyph, Row } from "../../../kit/index.ts";
import type { NoteCollection, NoteSummary } from "../types.ts";

export interface CollectionTreeProps {
  collections: readonly NoteCollection[];
  notes: readonly NoteSummary[];
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onOpenNote?: (id: string) => void;
  onNewNoteIn?: (collectionId: string) => void;
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
}: CollectionTreeProps) {
  const own = (id: string | null) => notes.filter((n) => n.collectionId === id);
  const noteRows = (id: string | null, level: number) =>
    own(id).map((n) => (
      <div
        className="ev-notes-line"
        style={{ paddingLeft: `calc(var(--sp-6) * ${level})` }}
        key={n.id}
      >
        <Row
          glyph={<Glyph type="note" />}
          title={n.title}
          meta={n.preview}
          value={n.when}
          onOpen={() => onOpenNote?.(n.id)}
        />
      </div>
    ));
  const fold = (
    id: string,
    title: string,
    level: number,
    count: number,
    withNew: boolean,
  ) => {
    const isOpen = open.has(id);
    return (
      <div
        className="ev-notes-fold"
        style={{ paddingLeft: `calc(var(--sp-6) * ${level})` }}
        data-key={id}
      >
        <button
          type="button"
          className="ev-notes-fold-btn"
          aria-expanded={isOpen}
          onClick={() => onToggle(id)}
        >
          <span className="ev-notes-chev" data-open={isOpen} aria-hidden="true">
            ›
          </span>
          <Glyph type={id === NONE ? "note" : "collection"} />
          <span className="ev-notes-fold-title">{title}</span>
          <span className="ev-notes-meta">
            {count} {count === 1 ? "note" : "notes"}
          </span>
        </button>
        {withNew ? (
          <Button
            kind="text"
            aria-label={`New note in ${title}`}
            onClick={() => onNewNoteIn?.(id)}
          >
            New note
          </Button>
        ) : null}
      </div>
    );
  };
  const tops = collections.filter((c) => !c.parentId);
  const loose = own(null).length;
  return (
    <div className="ev-notes-tree">
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
                    {open.has(k.id) ? noteRows(k.id, 2) : null}
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
