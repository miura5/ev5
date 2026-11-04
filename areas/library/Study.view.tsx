import { useState } from "react";
import { Button, EvLine, Field, Source } from "../../kit/index.ts";
import type { StudyItem } from "./types.ts";
import "./library.css";

export interface StudyViewProps {
  title: string;
  items: readonly StudyItem[];
  /** Called with each rating as it is given. */
  onRate?: (id: string, rating: "again" | "good", attempt: string) => void;
  /** Called when he taps "Just tell me"; the answer shows once this resolves true (an event is logged first). */
  onTell?: (id: string) => Promise<boolean>;
  onLeave?: () => void;
}

/** Study mode: one card, his attempt first, then the back with its source, then Again or Good. */
export function StudyView({
  title,
  items,
  onRate,
  onTell,
  onLeave,
}: StudyViewProps) {
  const [i, setI] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [shown, setShown] = useState(false);
  const [good, setGood] = useState(0);
  const it = items[i];
  if (!it)
    return (
      <section className="ev-library" aria-label="Study">
        <h1 className="ev-library-title">Done for now</h1>
        <span className="ev-library-meta">
          {items.length} items · {good} Good, {items.length - good} Again. Again
          comes back tomorrow.
        </span>
        <div>
          <Button kind="primary" hint="↵" onClick={onLeave}>
            Back to the set
          </Button>
        </div>
      </section>
    );
  const tell = async () => {
    if (!onTell || (await onTell(it.id))) setShown(true);
  };
  const rate = (r: "again" | "good") => {
    onRate?.(it.id, r, attempt);
    if (r === "good") setGood(good + 1);
    setI(i + 1);
    setAttempt("");
    setShown(false);
  };
  return (
    <section className="ev-library" aria-label="Study">
      <div className="ev-library-head">
        <Button kind="text" onClick={onLeave}>
          ← {title}
        </Button>
        <span className="ev-library-grow" />
        <span className="ev-library-meta">
          {i + 1} of {items.length}
        </span>
      </div>
      <div className="ev-library-card">
        <span className="ev-library-meta">{it.kicker}</span>
        <p className="ev-library-question">{it.front}</p>
        {shown ? (
          <>
            <span className="ev-library-meta">
              {attempt
                ? `You wrote: ${attempt}`
                : "Logged: you asked to see it first."}
            </span>
            <p>{it.back}</p>
            <Source from={it.from} />
            {it.note ? <EvLine quiet>{it.note}</EvLine> : null}
            <div className="ev-library-card-foot">
              <Button hint="1" onClick={() => rate("again")}>
                Again
              </Button>
              <Button hint="2" onClick={() => rate("good")}>
                Good
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field
              label="Your answer"
              placeholder="Your answer, in your words"
              value={attempt}
              onChange={(e) => setAttempt(e.target.value)}
            />
            <div className="ev-library-card-foot">
              <Button
                kind="primary"
                hint="↵"
                disabled={!attempt.trim()}
                onClick={() => setShown(true)}
              >
                Turn over
              </Button>
              <Button
                kind="text"
                title="Just tell me, logged"
                onClick={() => void tell()}
              >
                Just tell me
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
