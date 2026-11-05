import {
  Button,
  EditorRow,
  Glyph,
  Page,
  Section,
  TextOptions,
} from "../../kit/index.ts";
import type { SetEditData, SetItem, SetKind } from "./types.ts";

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
// The kit's editor row has two cells, so a step has a detail cell too (the kit lacks a one-cell row).
const HEADS: Record<SetKind, [string, string, string]> = {
  cards: ["Term", "Definition", "card"],
  questions: ["Question", "Answer", "question"],
  steps: ["Step", "Detail", "step"],
};

/** A set's page in Edit mode: title, type, rows to edit or delete, add a row, Done. */
export function SetEditView(p: SetEditViewProps) {
  const { set } = p;
  const [front, back, noun] = HEADS[set.kind];
  return (
    <Page
      title={set.title}
      titlePlaceholder="Untitled set"
      onTitle={p.onTitle}
      glyph={<Glyph type={set.kind} />}
      actions={
        <Button kind="primary" hint="⌘↵" onClick={p.onDone}>
          Done
        </Button>
      }
    >
      <TextOptions
        label="Type"
        value={set.kind}
        options={KINDS}
        onChange={(v) => p.onKind?.(v as SetKind)}
      />
      <Section label="Items">
        {set.items.map((it, i) => (
          <EditorRow
            key={it.id}
            cells={[
              {
                label: `${front} ${i + 1}`,
                value: it.front,
                onChange: (v) => p.onItem?.(it.id, { front: v }),
              },
              {
                label: `${back} ${i + 1}`,
                value: it.back ?? "",
                onChange: (v) => p.onItem?.(it.id, { back: v }),
              },
            ]}
            actions={
              <Button
                kind="icon"
                aria-label={`Delete row ${i + 1}`}
                onClick={() => p.onDeleteItem?.(it.id)}
              >
                ×
              </Button>
            }
          />
        ))}
        <div>
          <Button kind="text" onClick={p.onAddItem}>
            + {noun}
          </Button>
        </div>
      </Section>
    </Page>
  );
}
