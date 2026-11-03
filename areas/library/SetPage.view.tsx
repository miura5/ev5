import { Button, Glyph } from "../../kit/index.ts";
import type { SetPageData } from "./types.ts";
import "./library.css";

export interface SetPageViewProps {
  set: SetPageData;
  onStudy?: () => void;
  onBack?: () => void;
}

/** A set's page in view mode: title, Study, then its items with answers (browsing his own set shows them). */
export function SetPageView({ set, onStudy, onBack }: SetPageViewProps) {
  return (
    <section className="ev-library" aria-label="Set">
      <div className="ev-library-head">
        <Glyph type={set.kind} />
        <h1 className="ev-library-title">{set.title}</h1>
        <span className="ev-library-meta">{set.meta}</span>
        <span className="ev-library-grow" />
        {onBack ? (
          <Button kind="text" onClick={onBack}>
            Library
          </Button>
        ) : null}
        <Button kind="primary" onClick={onStudy}>
          Study
        </Button>
      </div>
      {set.items.length === 0 ? (
        <span className="ev-library-meta">No items yet.</span>
      ) : (
        <ol className="ev-library-items">
          {set.items.map((it) => (
            <li key={it.id} className="ev-library-item">
              <span>{it.front}</span>
              {it.back ? (
                <span className="ev-library-meta">{it.back}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
