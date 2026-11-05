import { useState } from "react";
import { Button } from "../Button/Button";
import { MovePicker, type MoveTarget } from "./MovePicker";

const TARGETS: MoveTarget[] = [
  { id: "nur", title: "NUR 112" },
  { id: "pharm", title: "Pharmacology", parentId: "nur" },
  { id: "bio", title: "BIO 201" },
];

export function Story() {
  const [current, setCurrent] = useState<string | null>("pharm");
  return (
    <div data-ui="story-move-picker">
      <MovePicker
        label="Move to"
        targets={TARGETS}
        current={current}
        onMove={setCurrent}
        noneLabel="No collection"
        trigger={<Button>Move…</Button>}
      />
      <p>
        In: {TARGETS.find((t) => t.id === current)?.title ?? "No collection"}
      </p>
    </div>
  );
}
