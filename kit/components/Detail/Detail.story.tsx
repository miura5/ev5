import { useState } from "react";
import { Detail } from "./Detail";

export function Story() {
  const [coll, setColl] = useState("BIO 201");
  return (
    <div data-ui="story-detail">
      <Detail
        title="Cardiac output terms"
        primary={{ label: "Study", hint: "S", onRun: () => undefined }}
        more={{
          items: [
            { key: "rename", label: "Rename" },
            { key: "delete", label: "Delete", danger: true },
          ],
          onPick: () => undefined,
        }}
        properties={[
          { label: "Collection", value: coll, onChange: setColl },
          { label: "Cards", value: "8" },
          { label: "Due", value: "4" },
        ]}
      />
    </div>
  );
}
