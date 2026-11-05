import { useEffect, useRef } from "react";
import {
  Button,
  Glyph,
  Menu,
  Row,
  type GlyphType,
  type MenuItem,
} from "../../kit/index.ts";
import { RowActions } from "./RowActions.tsx";
import "./collection.css";

/** One thing in a collection as the collection read reports it; areas never import data, so the shape is restated. */
export interface CollectionEntry {
  id: string;
  type: GlyphType;
  title: string;
  meta?: string;
  value?: string;
  /** Where Open goes, when the item lives in another area. */
  to?: string;
}

export type NewKind = "note" | "set" | "date" | "collection";

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
  /** An item's ⋯ menu pick: "open", "pin", "unpin" or "delete" (the item.* commands). */
  onItemAction?: (
    id: string,
    action: "open" | "pin" | "unpin" | "delete",
  ) => void;
  /** Move picked a collection for an item (item.move). */
  onMove?: (id: string, collectionId: string) => void;
  /** Every collection, for the Move picker. */
  targets?: readonly { id: string; title: string }[];
  /** The New menu pick: a note, a set, a date, or a collection inside (not offered inside a nested one). */
  onNewHere?: (kind: NewKind) => void;
  /** A collection just made: its title takes the cursor, selected, ready to type. */
  focusTitle?: boolean;
  onTogglePin?: () => void;
  onBack?: () => void;
  onRename?: (title: string) => void;
  /** Delete this collection: its items show ungrouped and Restore (Recently deleted) regroups them. */
  onDelete?: () => void;
}

function EntryRow({
  e,
  pinned,
  targets,
  onOpen,
  onAction,
  onMove,
}: {
  e: CollectionEntry;
  pinned: boolean;
  targets: readonly { id: string; title: string }[];
  onOpen?: (id: string) => void;
  onAction?: CollectionViewProps["onItemAction"];
  onMove?: CollectionViewProps["onMove"];
}) {
  const row = (
    <Row
      title={e.title}
      meta={e.meta}
      value={e.value}
      glyph={<Glyph type={e.type} />}
      onOpen={onOpen ? () => onOpen(e.id) : undefined}
    />
  );
  if (!onAction) return row;
  return (
    <RowActions
      title={e.title}
      entry={e.id}
      pinned={pinned}
      targets={targets.filter((t) => t.id !== e.id)}
      onAction={(a) => onAction(e.id, a)}
      onMove={onMove ? (c) => onMove(e.id, c) : undefined}
    >
      {row}
    </RowActions>
  );
}

/** A collection Matt made: dates first, then everything in it, newest first. Pin, New and rename are his. */
export function CollectionView(p: CollectionViewProps) {
  const pinnedIds = new Set((p.pinnedItems ?? []).map((x) => x.id));
  const entry = (e: CollectionEntry) => (
    <EntryRow
      key={e.id}
      e={e}
      pinned={pinnedIds.has(e.id)}
      targets={p.targets ?? []}
      onMove={p.onMove}
      onOpen={p.onOpen}
      onAction={p.onItemAction}
    />
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!p.focusTitle || !el) return;
    el.focus();
    getSelection()?.selectAllChildren(el);
  }, [p.focusTitle]);
  const newItems: MenuItem[] = [
    { key: "note", label: "Note" },
    { key: "set", label: "Set" },
    { key: "date", label: "Date" },
    ...(p.parent ? [] : [{ key: "collection", label: "Collection inside" }]),
  ];
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
            ref={titleRef}
            className="ev-coll-title"
            contentEditable={p.onRename ? true : undefined}
            suppressContentEditableWarning
            data-placeholder="Untitled collection"
            tabIndex={p.onRename ? 0 : undefined}
            onKeyDown={(e) => {
              if (!p.onRename) return;
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.currentTarget.textContent = p.title;
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => p.onRename?.(e.currentTarget.textContent ?? "")}
          >
            {p.title}
          </h1>
          <span className="ev-coll-meta">
            Collection · {count} {count === 1 ? "item" : "items"}
            {p.pinned ? " · pinned" : ""}
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
        <Menu
          label="New in this collection"
          items={newItems}
          onPick={(k) => p.onNewHere?.(k as NewKind)}
          trigger={
            <Button kind="text" hint="C" aria-label="New in this collection">
              New
            </Button>
          }
        />
        {p.onDelete ? (
          <Button kind="text" onClick={p.onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
      {p.pinnedItems && p.pinnedItems.length > 0 ? (
        <div className="ev-coll-sec" data-section="Pinned">
          <h2 className="ev-coll-label">Pinned</h2>
          {p.pinnedItems.map(entry)}
        </div>
      ) : null}
      {p.dates.length > 0 ? (
        <div className="ev-coll-sec" data-section="Coming up">
          <h2 className="ev-coll-label">Coming up</h2>
          {p.dates.map(entry)}
        </div>
      ) : null}
      {p.nested.length + p.items.length > 0 ? (
        <div className="ev-coll-sec" data-section="Everything">
          <div className="ev-coll-sec-head">
            <h2 className="ev-coll-label">Everything</h2>
            <span className="ev-coll-meta">newest first</span>
          </div>
          {[...p.nested, ...p.items].map(entry)}
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
