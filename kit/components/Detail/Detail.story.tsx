import { useState } from "react";
import { Detail } from "./Detail";

export function Story() {
  const [coll, setColl] = useState("Economics 101");
  return (
    <div data-ui="story-detail">
      <Detail
        title="Supply and demand terms"
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
