import { Button } from "../../../kit/index.ts";
import type { PracticeSession } from "../types.ts";

export interface PracticePanelProps {
  session: PracticeSession | null;
  onCommit?: (option: string) => void;
  onEnd?: () => void;
}

/** One question in focus with its options and source; a quiet line when nothing is running. */
export function PracticePanel({
  session,
  onCommit,
  onEnd,
}: PracticePanelProps) {
  if (!session)
    return <span className="ev-library-meta">No practice running.</span>;
  return (
    <form
      className="ev-library-card"
      onSubmit={(e) => {
        e.preventDefault();
        const picked = new FormData(e.currentTarget).get("option");
        if (typeof picked === "string") onCommit?.(picked);
      }}
    >
      <div className="ev-library-card-head">
        <span className="ev-library-meta">{session.title}</span>
        <Button kind="text" onClick={onEnd}>
          End
        </Button>
      </div>
      <div className="ev-library-q">
        <p className="ev-library-question">{session.question}</p>
        <span className="ev-library-meta">
          {session.position} of {session.total}
        </span>
      </div>
      {session.options.map((o) => (
        <label className="ev-library-opt" key={o}>
          <input type="radio" name="option" value={o} />
          {o}
        </label>
      ))}
      <div className="ev-library-card-foot">
        <span className="ev-library-meta">{session.source}</span>
        <Button kind="primary" type="submit">
          Commit answer
        </Button>
      </div>
    </form>
  );
}
