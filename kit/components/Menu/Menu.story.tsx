import { useState } from "react";
import { Menu } from "./Menu";

export function Story() {
  const [last, setLast] = useState("");
  return (
    <div data-ui="story-menu">
      <Menu
        label="Item actions"
        onClose={() => setLast("closed")}
        onPick={setLast}
        items={[
          { key: "pin", label: "Pin", hint: "P" },
          { key: "move", label: "Move to…", hint: "M" },
          { key: "delete", label: "Delete", hint: "⌫", danger: true },
        ]}
      />
      <Menu
        label="Sort by"
        onClose={() => setLast("closed")}
        onPick={setLast}
        items={[
          { key: "due", label: "Due", checked: true },
          { key: "name", label: "Name", checked: false },
        ]}
      />
      <p>{last ? `Picked: ${last}` : "Nothing picked"}</p>
    </div>
  );
}
