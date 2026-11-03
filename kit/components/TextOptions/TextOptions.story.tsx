import { useState } from "react";
import { TextOptions } from "./TextOptions";

export function Story() {
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState("cards");
  return (
    <div data-ui="story-text-options">
      <TextOptions
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: 14 },
          { value: "due", label: "Due", count: 3 },
          { value: "new", label: "New" },
        ]}
      />
      <TextOptions
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "cards", label: "Cards" },
          { value: "learn", label: "Learn" },
          { value: "test", label: "Test" },
        ]}
      />
    </div>
  );
}
