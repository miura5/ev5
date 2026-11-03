import { useState } from "react";
import { Field, Segmented } from "./Field";

export function Story() {
  const [n, setN] = useState("5");
  return (
    <div data-ui="story-field">
      <Field label="Title" placeholder="Untitled" />
      <Segmented
        label="How many"
        options={["3", "5", "8"]}
        value={n}
        onChange={setN}
      />
    </div>
  );
}
