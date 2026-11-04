import { Button, Glyph, Row, type GlyphType } from "../../kit/index.ts";
import "./collection.css";

/** One thing in a collection as the collection read reports it; areas never import data, so the shape is restated. */
export interface CollectionEntry {
  id: string;
  type: GlyphType;
  title: string;
  meta?: string;
  value?: string;
}

export interface CollectionViewProps {
  title: string;
  /** The parent collection's name, when this one is nested. */
  parent?: string;
  pinned?: boolean;
  /** Pinned items (from /pins), shown under "Pinned" before the rest. */
  pinnedItems?: readonly CollectionEntry[];
  /** Dated goals, shown first under "Coming up". */
  dates: readonly CollectionEntry[];
  /** Nested collections (one level) then items, newest first. */
  nested: readonly CollectionEntry[];
  items: readonly CollectionEntry[];
  onOpen?: (id: string) => void;
  onNew?: () => void;
  onTogglePin?: () => void;
  onBack?: () => void;
  onRename?: (title: string) => void;
}

function EntryRow({
  e,
  onOpen,
}: {
  e: CollectionEntry;
  onOpen?: (id: string) => void;
}) {
  return (
    <Row
      title={e.title}
      meta={e.meta}
      value={e.value}
      glyph={<Glyph type={e.type} />}
      onOpen={onOpen ? () => onOpen(e.id) : undefined}
    />
  );
}

/** A collection Matt made: dates first, then everything in it, newest first. Pin, New and rename are his. */
export function CollectionView(p: CollectionViewProps) {
  const count = p.dates.length + p.nested.length + p.items.length;
  return (
    <section className="ev-coll" aria-label="Collection">
      {p.parent ? (
        <Button kind="text" onClick={p.onBack}>
          ← {p.parent}
        </Button>
      ) : null}
      <div className="ev-coll-head">
        <Glyph type="collection" />
        <div className="ev-coll-heading">
          <h1
            className="ev-coll-title"
            contentEditable={p.onRename ? true : undefined}
            suppressContentEditableWarning
            data-placeholder="Untitled collection"
            onBlur={(e) => p.onRename?.(e.currentTarget.textContent ?? "")}
          >
            {p.title}
          </h1>
          <span className="ev-coll-meta">
            Collection · {count} items{p.pinned ? " · pinned" : ""}
          </span>
        </div>
        <Button
          kind="text"
          hint="P"
          onClick={p.onTogglePin}
          aria-pressed={!!p.pinned}
        >
          {p.pinned ? "Unpin" : "Pin"}
        </Button>
        <Button kind="text" hint="C" onClick={p.onNew}>
          New
        </Button>
      </div>
      {p.pinnedItems && p.pinnedItems.length > 0 ? (
        <div className="ev-coll-sec" data-section="Pinned">
          <h2 className="ev-coll-label">Pinned</h2>
          {p.pinnedItems.map((e) => (
            <EntryRow key={e.id} e={e} onOpen={p.onOpen} />
          ))}
        </div>
      ) : null}
      {p.dates.length > 0 ? (
        <div className="ev-coll-sec" data-section="Coming up">
          <h2 className="ev-coll-label">Coming up</h2>
          {p.dates.map((e) => (
            <EntryRow key={e.id} e={e} onOpen={p.onOpen} />
          ))}
        </div>
      ) : null}
      {p.nested.length + p.items.length > 0 ? (
        <div className="ev-coll-sec" data-section="Everything">
          <div className="ev-coll-sec-head">
            <h2 className="ev-coll-label">Everything</h2>
            <span className="ev-coll-meta">newest first</span>
          </div>
          {[...p.nested, ...p.items].map((e) => (
            <EntryRow key={e.id} e={e} onOpen={p.onOpen} />
          ))}
        </div>
      ) : (
        <div className="ev-coll-empty">
          Nothing here yet. New adds a note, a set or a date here; or move
          things in from their menu.
        </div>
      )}
    </section>
  );
}
