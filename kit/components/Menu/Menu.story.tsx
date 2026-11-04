import { useState } from "react";
import { Button } from "../Button/Button";
import { Menu } from "./Menu";

export function Story() {
  const [last, setLast] = useState("");
  const [sort, setSort] = useState("due");
  return (
    <div data-ui="story-menu">
      <Menu
        label="Item actions"
        onClose={() => setLast("closed")}
        onPick={setLast}
        trigger={
          <Button kind="icon" aria-label="Item actions">
            ⋯
          </Button>
        }
        items={[
          { key: "pin", label: "Pin", hint: "P" },
          { key: "move", label: "Move to…", hint: "M" },
          { key: "delete", label: "Delete", hint: "⌫", danger: true },
        ]}
      />
      <Menu
        label="Sort by"
        onPick={setSort}
        trigger={<Button>Sort: {sort}</Button>}
        items={[
          { key: "due", label: "Due", checked: sort === "due" },
          { key: "name", label: "Name", checked: sort === "name" },
        ]}
      />
      <Menu
        on="contextmenu"
        label="Row actions"
        onPick={setLast}
        trigger={<p>Right-click for actions</p>}
        items={[{ key: "open", label: "Open" }]}
      />
      <p>{last ? `Picked: ${last}` : "Nothing picked"}</p>
    </div>
  );
}
