import { Button, Empty, Glyph, Page, Row, Section, type GlyphType } from "../../kit/index.ts";

/** One deleted item as the deleted-items read reports it; areas never import data, so the shape is restated. */
export interface DeletedItem {
  id: string;
  type: GlyphType;
  title: string;
  /** Plain words, e.g. "Nov 1". */
  deletedOn: string;
  /** What it was, in plain words, e.g. "Note". */
  kind?: string;
  /** The collection it was in, if any. */
  from?: string;
  daysLeft: number;
}

export interface DeletedViewProps {
  items: readonly DeletedItem[];
  onRestore?: (id: string) => void;
}

/** Recently deleted: items Matt deleted, kept 30 days with Restore; there is no "delete forever". */
export function DeletedView({ items, onRestore }: DeletedViewProps) {
  return (
    <Page title="Recently deleted" meta="kept 30 days, then removed from E.V. Backups keep everything.">
      <Section label={`${items.length} items`}>
        {items.length === 0 ? <Empty line="Nothing here." /> : null}
        {items.map((it) => (
          <Row
            key={it.id}
            title={it.title}
            meta={`${it.kind ? `${it.kind} · ` : ""}deleted ${it.deletedOn}${it.from ? ` · from ${it.from}` : ""}`}
            value={`${it.daysLeft} days left`}
            glyph={<Glyph type={it.type} />}
            actions={
              <Button kind="text" onClick={() => onRestore?.(it.id)} aria-label={`Restore ${it.title}`}>
                Restore
              </Button>
            }
          />
        ))}
      </Section>
    </Page>
  );
}
