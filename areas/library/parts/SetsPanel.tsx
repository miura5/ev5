import { useState } from "react";
import { Glyph, TextOptions, Tile } from "../../../kit/index.ts";
import type { LibrarySet, SetKind } from "../types.ts";

type Filter = "all" | SetKind;

const OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cards", label: "Cards" },
  { value: "questions", label: "Questions" },
  { value: "steps", label: "Steps" },
];

/** The Sets tab: tiles filtered by type, in the order given. */
export function SetsPanel({
  sets,
  onOpenSet,
}: {
  sets: readonly LibrarySet[];
  onOpenSet?: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const count = (k: Filter) =>
    k === "all" ? sets.length : sets.filter((s) => s.kind === k).length;
  const shown = filter === "all" ? sets : sets.filter((s) => s.kind === filter);
  return (
    <>
      <TextOptions
        label="Filter sets"
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        options={OPTIONS.map((o) => ({ ...o, count: count(o.value) }))}
      />
      {shown.length === 0 ? (
        <span className="ev-library-meta">
          No {filter === "all" ? "" : `${filter} `}sets yet.
        </span>
      ) : (
        <div className="ev-library-tiles">
          {shown.map((s) => (
            <Tile
              key={s.id}
              title={s.title}
              meta={s.meta}
              value={s.due}
              glyph={<Glyph type={s.kind} />}
              onOpen={onOpenSet ? () => onOpenSet(s.id) : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
