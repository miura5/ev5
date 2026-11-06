import { useState } from "react";
import { Tabs } from "./Tabs";

export function Story() {
  const [a, setA] = useState("practice");
  const [b, setB] = useState("sets");
  return (
    <div
      data-ui="story-tabs"
      style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
    >
      <Tabs
        label="Library with counts"
        tabs={[
          { id: "practice", label: "Practice", count: 3 },
          { id: "weak", label: "Weak spots", count: 5 },
          { id: "sets", label: "Sets", count: 12 },
        ]}
        value={a}
        onChange={setA}
      />
      <Tabs
        label="Library without counts"
        tabs={[
          { id: "sets", label: "Sets" },
          { id: "dates", label: "Dates" },
        ]}
        value={b}
        onChange={setB}
      />
    </div>
  );
}
