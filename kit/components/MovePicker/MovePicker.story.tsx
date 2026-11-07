import { useState } from "react";
import { Button } from "../Button/Button";
import { MovePicker, type MoveTarget } from "./MovePicker";

const TARGETS: MoveTarget[] = [
  { id: "course", title: "Course 101" },
  { id: "cells", title: "Chapter notes", parentId: "course" },
  { id: "econ", title: "Economics 101" },
];

export function Story() {
  const [current, setCurrent] = useState<string | null>("cells");
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
