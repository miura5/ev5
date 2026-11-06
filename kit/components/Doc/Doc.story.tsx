import { useState } from "react";
import { Doc } from "./Doc";

export function Story() {
  const [done, setDone] = useState<string[]>([]);
  const checks = ["Say the idea", "Name an example"].map((text) => ({
    id: text,
    text,
    done: done.includes(text),
  }));
  return (
    <div data-ui="story-doc">
      <Doc title="Supply and demand" meta="Economics 101 · edited today">
        <p>Supply and demand set the price of goods.</p>
      </Doc>
      <Doc
        title="Supply and demand"
        session={{
          label: "Studying · Supply and demand",
          onLeave: () => undefined,
          checks,
          onToggle: (id) =>
            setDone((d) =>
              d.includes(id) ? d.filter((x) => x !== id) : [...d, id],
            ),
        }}
      >
        <p>Scarcity is wanting more than exists.</p>
      </Doc>
    </div>
  );
}
