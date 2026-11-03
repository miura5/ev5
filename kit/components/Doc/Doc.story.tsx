import { useState } from "react";
import { Doc } from "./Doc";

export function Story() {
  const [done, setDone] = useState<string[]>([]);
  const checks = ["Say the formula", "Name the units"].map((text) => ({
    id: text,
    text,
    done: done.includes(text),
  }));
  return (
    <div data-ui="story-doc">
      <Doc title="Cardiac output" meta="BIO 201 · edited today">
        <p>Cardiac output is heart rate times stroke volume.</p>
      </Doc>
      <Doc
        title="Cardiac output"
        session={{
          label: "Studying · Cardiac output",
          onLeave: () => undefined,
          checks,
          onToggle: (id) =>
            setDone((d) =>
              d.includes(id) ? d.filter((x) => x !== id) : [...d, id],
            ),
        }}
      >
        <p>Stroke volume is blood ejected per beat.</p>
      </Doc>
    </div>
  );
}
