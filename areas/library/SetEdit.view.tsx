import { Button, Field, Glyph, TextOptions } from "../../kit/index.ts";
import type { SetEditData, SetItem, SetKind } from "./types.ts";
import "./library.css";

export interface SetEditViewProps {
  set: SetEditData;
  onTitle?: (title: string) => void;
  onKind?: (kind: SetKind) => void;
  onItem?: (id: string, patch: Partial<Omit<SetItem, "id">>) => void;
  onAddItem?: () => void;
  onDeleteItem?: (id: string) => void;
  onDone?: () => void;
}

const KINDS = [
  { value: "cards", label: "Cards" },
  { value: "questions", label: "Questions" },
  { value: "steps", label: "Steps" },
];
const HEADS: Record<SetKind, [string, string, string]> = {
  cards: ["Term", "Definition", "card"],
  questions: ["Question", "Answer", "question"],
  steps: ["Step", "", "step"],
};

/** A set's page in Edit mode: title, type, rows to edit or delete, add a row, Done. */
export function SetEditView(p: SetEditViewProps) {
  const { set } = p;
  const [front, back, noun] = HEADS[set.kind];
  return (
    <section className="ev-library" aria-label="Edit set">
      <div className="ev-library-head">
        <Glyph type={set.kind} />
        <Field
          label="Title"
          placeholder="Untitled set"
          value={set.title}
          onChange={(e) => p.onTitle?.(e.target.value)}
        />
        <Button kind="primary" hint="⌘↵" onClick={p.onDone}>
          Done
        </Button>
      </div>
      <TextOptions
        label="Type"
        value={set.kind}
        options={KINDS}
        onChange={(v) => p.onKind?.(v as SetKind)}
      />
      <div className="ev-library-items">
        {set.items.map((it, i) => (
          <div className="ev-library-erow" key={it.id} data-key={it.id}>
            <span className="ev-library-meta">{i + 1}</span>
            <Field
              label={`${front} ${i + 1}`}
              placeholder={front}
              value={it.front}
              onChange={(e) => p.onItem?.(it.id, { front: e.target.value })}
            />
            {set.kind === "steps" ? null : (
              <Field
                label={`${back} ${i + 1}`}
                placeholder={back}
                value={it.back ?? ""}
                onChange={(e) => p.onItem?.(it.id, { back: e.target.value })}
              />
            )}
            <Button
              kind="icon"
              aria-label={`Delete row ${i + 1}`}
              onClick={() => p.onDeleteItem?.(it.id)}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <div>
        <Button kind="text" onClick={p.onAddItem}>
          + {noun}
        </Button>
      </div>
    </section>
  );
}
