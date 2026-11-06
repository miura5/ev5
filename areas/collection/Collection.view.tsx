import { useState } from "react";
import {
  Button,
  Empty,
  Glyph,
  Menu,
  Page,
  Palette,
  Row,
  Section,
  type GlyphType,
  type MenuItem,
} from "../../kit/index.ts";

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

type ItemAction = "open" | "pin" | "unpin" | "delete";

/** One row of the page: the kit Row with its menu (right-click, the . key, the dots) and Move's picker. */
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
  const [moving, setMoving] = useState(false);
  const items: MenuItem[] = [
    { key: "open", label: "Open" },
    pinned ? { key: "unpin", label: "Unpin" } : { key: "pin", label: "Pin" },
    ...(onMove ? [{ key: "move", label: "Move…" }] : []),
    { key: "delete", label: "Delete", danger: true },
  ];
  return (
    <>
      <Row
        title={e.title}
        meta={e.meta}
        value={e.value}
        glyph={<Glyph type={e.type} />}
        onOpen={onOpen ? () => onOpen(e.id) : undefined}
        menu={
          onAction
            ? {
                items,
                label: `Actions for ${e.title}`,
                button: true,
                onPick: (k) => {
                  if (k === "move") setMoving(true);
                  else onAction(e.id, k as ItemAction);
                },
              }
            : undefined
        }
      />
      {moving ? (
        <Palette
          ask={false}
          label={`Move ${e.title} to`}
          placeholder="Move to a collection"
          groups={[
            {
              name: "Move to",
              items: targets
                .filter((t) => t.id !== e.id)
                .map((t) => ({ key: t.id, label: t.title })),
            },
          ]}
          onRun={(id) => {
            setMoving(false);
            onMove?.(e.id, id);
          }}
          onClose={() => setMoving(false)}
        />
      ) : null}
    </>
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
  const newItems: MenuItem[] = [
    { key: "note", label: "Note" },
    { key: "set", label: "Set" },
    { key: "date", label: "Date" },
    ...(p.parent ? [] : [{ key: "collection", label: "Collection inside" }]),
  ];
  const count = p.dates.length + p.nested.length + p.items.length;
  return (
    <Page
      title={p.title}
      onTitle={p.onRename}
      titlePlaceholder="Untitled collection"
      focusTitle={p.focusTitle}
      glyph={<Glyph type="collection" />}
      meta={`Collection · ${count} ${count === 1 ? "item" : "items"}${p.pinned ? " · pinned" : ""}`}
      crumb={
        p.parent ? (
          <Button kind="text" onClick={p.onBack}>
            ← {p.parent}
          </Button>
        ) : undefined
      }
      actions={
        <>
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
        </>
      }
    >
      {p.pinnedItems && p.pinnedItems.length > 0 ? (
        <Section label="Pinned">{p.pinnedItems.map(entry)}</Section>
      ) : null}
      {p.dates.length > 0 ? (
        <Section label="Coming up">{p.dates.map(entry)}</Section>
      ) : null}
      {p.nested.length + p.items.length > 0 ? (
        <Section label="Everything" count="newest first">
          {[...p.nested, ...p.items].map(entry)}
        </Section>
      ) : (
        <Empty line="Nothing here yet. New adds a note, a set or a date here; or move things in from their menu." />
      )}
    </Page>
  );
}
