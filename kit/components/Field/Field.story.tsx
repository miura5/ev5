import { useState } from "react";
import { Choice, Field, Segmented, TextArea } from "./Field";

export function Story() {
  const [n, setN] = useState("5");
  return (
    <div data-ui="story-field">
      <Field label="Title" placeholder="Untitled" />
      <TextArea label="Your answer" placeholder="Your words" />
      <Choice kind="checkbox" defaultChecked>
        Done
      </Choice>
      <Choice kind="radio" name="story-option" defaultChecked>
        One answer
      </Choice>
      <Segmented
        label="How many"
        options={["3", "5", "8"]}
        value={n}
        onChange={setN}
      />
    </div>
  );
}
