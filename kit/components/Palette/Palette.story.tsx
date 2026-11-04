import { useState } from "react";
import { Palette } from "./Palette";

const groups = [
  {
    name: "Commands",
    items: [
      { key: "start-next", label: "Start next", hint: "S" },
      { key: "new-note", label: "New note" },
      { key: "theme", label: "Switch theme", hint: "\\" },
    ],
  },
  {
    name: "Go to",
    items: [
      { key: "go:today", label: "Today" },
      { key: "go:ask", label: "Ask E.V.", hint: "⌘J" },
      { key: "go:library", label: "Library" },
    ],
  },
];

export function Story() {
  const [last, setLast] = useState("");
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <div data-ui="story-palette" ref={setHost}>
      {host ? (
        <Palette
          groups={groups}
          container={host}
          onRun={(k) => setLast(`ran ${k}`)}
          onAsk={(t) => setLast(`asked E.V.: ${t}`)}
          onClose={() => setLast("closed")}
        />
      ) : null}
      <p>{last || "Nothing run"}</p>
    </div>
  );
}
