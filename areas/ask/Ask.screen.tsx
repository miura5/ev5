import { useState } from "react";
import { AskView } from "./Ask.view.tsx";
import type { AskMessage } from "./types.ts";

const clock = () =>
  new Date()
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
    .toLowerCase();

/** The mounted view until the data wiring lands: an empty chat that keeps what the user types on screen. */
export function AskScreen() {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  return (
    <AskView
      messages={messages}
      onSend={(text) => setMessages((m) => [...m, { id: `m${m.length + 1}`, from: "you", at: clock(), text }])}
    />
  );
}
