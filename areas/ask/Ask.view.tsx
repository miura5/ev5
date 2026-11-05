import { Empty, Page, Toast } from "../../kit/index.ts";
import "./ask.css";
import { Message } from "./parts/Message.tsx";
import { Composer } from "./parts/Composer.tsx";
import type { AskMessage } from "./types.ts";

export interface AskViewProps {
  messages: readonly AskMessage[];
  onSend: (text: string) => void;
  onJustTell?: (id: string) => void;
  onOpenSource?: (source: string) => void;
  onOpenJob?: (id: string) => void;
  initialDraft?: string;
  /** A line under the chat, e.g. a write that failed. */
  notice?: string;
}

/** Ask E.V.: attempt first. Props in, events out; the shell wires the data. */
export function AskView({
  messages,
  onSend,
  onJustTell,
  onOpenSource,
  onOpenJob,
  initialDraft,
  notice,
}: AskViewProps) {
  const lastEv = messages.map((m) => m.from).lastIndexOf("ev");
  return (
    <Page title="Ask E.V." meta="ask anything; she'll want your try first">
      <section className="ask" aria-label="Ask E.V.">
        {messages.length === 0 ? (
          <Empty line="Nothing asked yet. Type below to start." />
        ) : (
          <div className="ask-chat">
            {messages.map((m, i) => (
              <div key={m.id} className="ask-turn">
                {m.from === "ev" && m.breakBefore ? (
                  <div className="ask-break" role="separator" />
                ) : null}
                <Message
                  message={m}
                  latest={i === lastEv}
                  onJustTell={onJustTell}
                  onOpenSource={onOpenSource}
                  onOpenJob={onOpenJob}
                />
              </div>
            ))}
          </div>
        )}
        {notice ? <Toast message={notice} /> : null}
        <Composer onSend={onSend} initial={initialDraft} />
      </section>
    </Page>
  );
}
