import { Button, EvLine, Glyph, Row, Source } from "../../../kit/index.ts";
import type { AskMessage } from "../types.ts";

export interface MessageProps {
  message: AskMessage;
  /** E.V.'s mark stays orange only on the latest E.V. turn. */
  latest?: boolean;
  onJustTell?: (id: string) => void;
  onOpenSource?: (source: string) => void;
  onOpenJob?: (id: string) => void;
}

/** One turn: no bubbles. Her turns carry her ring in the gutter, yours a quiet "You" and the time. */
export function Message({ message, latest, onJustTell, onOpenSource, onOpenJob }: MessageProps) {
  if (message.from === "you") {
    return (
      <div className="ask-msg ask-me" data-ui="ask-message" data-from="you">
        <div className="ask-say">
          <div className="ask-who">
            You<time>{message.at}</time>
          </div>
          <div>{message.text}</div>
        </div>
      </div>
    );
  }
  const { id, text, source, asksTry, job } = message;
  return (
    <div className="ask-msg" data-ui="ask-message" data-from="ev">
      <div className="ask-ev">
        <EvLine quiet={!latest}>{text}</EvLine>
      </div>
      <div className="ask-say">
        {asksTry ? (
          <div className="ask-try">
            <Button kind="text" hint="⌥↵" onClick={() => onJustTell?.(id)}>
              Just tell me
            </Button>
          </div>
        ) : null}
        {source ? (
          <div>
            <Source from={source} onOpen={onOpenSource ? () => onOpenSource(source) : undefined} />
          </div>
        ) : null}
        {job ? (
          <Row
            title={job.title}
            meta={job.meta}
            value={job.value}
            glyph={<Glyph type="job" running={job.running} />}
            onOpen={onOpenJob ? () => onOpenJob(id) : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
