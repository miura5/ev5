import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../Button/Button";
import { Choice } from "../Field/Field";
import { EvLine } from "../EvLine/EvLine";

export interface PracticeCardProps {
  /** The set the question comes from. */
  title: string;
  question: ReactNode;
  /** 1-based place in the run, shown as "2 of 8". */
  position: number;
  total: number;
  options: readonly string[];
  /** Where the question came from. */
  source: string;
  /** A nudge shown only after Hint is pressed; no Hint button without it. */
  hint?: string;
  onCommit?: (option: string) => void;
  onEnd?: () => void;
}

/** A multiple-choice question in focus: pick an option, then commit it. */
export function PracticeCard({
  title,
  question,
  position,
  total,
  options,
  source,
  hint,
  onCommit,
  onEnd,
}: PracticeCardProps) {
  const [hinted, setHinted] = useState(false);
  return (
    <form
      className="kit-pcard"
      data-ui="practice-card"
      onSubmit={(e) => {
        e.preventDefault();
        const picked = new FormData(e.currentTarget).get("option");
        if (typeof picked === "string") onCommit?.(picked);
      }}
    >
      <div className="kit-pcard-row">
        <span className="kit-pcard-meta">{title}</span>
        <Button kind="text" onClick={onEnd}>
          End
        </Button>
      </div>
      <div className="kit-pcard-row">
        <p className="kit-pcard-question">{question}</p>
        <span className="kit-pcard-meta">
          {position} of {total}
        </span>
      </div>
      {options.map((o) => (
        <Choice kind="radio" key={o} name="option" value={o}>
          {o}
        </Choice>
      ))}
      {hinted && hint ? <EvLine quiet>{hint}</EvLine> : null}
      <div className="kit-pcard-row">
        <span className="kit-pcard-meta">{source}</span>
        {hint && !hinted ? (
          <Button kind="text" onClick={() => setHinted(true)}>
            Hint
          </Button>
        ) : null}
        <Button kind="primary" type="submit">
          Commit answer
        </Button>
      </div>
    </form>
  );
}
