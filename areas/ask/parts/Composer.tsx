import { useState } from "react";

export interface ComposerProps {
  onSend: (text: string) => void;
  /** Text to start with, e.g. from the palette's "ask E.V.". */
  initial?: string;
}

/** The message box: Enter sends, Shift+Enter adds a line. */
export function Composer({ onSend, initial = "" }: ComposerProps) {
  const [text, setText] = useState(initial);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };
  return (
    <div className="ask-composer">
      <textarea
        className="ask-field"
        rows={1}
        value={text}
        placeholder="Ask E.V., or answer her"
        aria-label="Message to E.V."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="ask-foot">
        <span className="ask-hint">
          <kbd className="ask-kbd">↵</kbd>send
        </span>
        <span className="ask-hint">
          <kbd className="ask-kbd">⇧↵</kbd>new line
        </span>
        <span className="ask-grow" />
        <span className="ask-hint">
          <kbd className="ask-kbd">⌘J</kbd>from anywhere
        </span>
      </div>
    </div>
  );
}
