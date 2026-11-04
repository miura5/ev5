import { Button, Glyph, Row, type GlyphType } from "../../kit/index.ts";
import "./deleted.css";

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
    <section className="ev-deleted" aria-label="Recently deleted">
      <div className="ev-deleted-head">
        <h1 className="ev-deleted-title">Recently deleted</h1>
        <span className="ev-deleted-meta">kept 30 days, then removed from E.V. Backups keep everything.</span>
      </div>
      <div className="ev-deleted-sec">
        <h2 className="ev-deleted-label">{items.length} items</h2>
        {items.length === 0 ? <span className="ev-deleted-meta">Nothing here.</span> : null}
        {items.map((it) => (
          <div className="ev-deleted-item" key={it.id} data-item={it.id}>
            <div className="ev-deleted-row">
              <Row
                title={it.title}
                meta={`${it.kind ? `${it.kind} · ` : ""}deleted ${it.deletedOn}${it.from ? ` · from ${it.from}` : ""}`}
                value={`${it.daysLeft} days left`}
                glyph={<Glyph type={it.type} />}
              />
            </div>
            <Button kind="text" onClick={() => onRestore?.(it.id)} aria-label={`Restore ${it.title}`}>
              Restore
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
