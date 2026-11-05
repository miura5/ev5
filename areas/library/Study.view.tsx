import { useState } from "react";
import { Button, EvLine, Field, Page, StudyCard } from "../../kit/index.ts";
import type { StudyItem } from "./types.ts";

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
      <Page
        title="Done for now"
        meta={`${items.length} items · ${good} Good, ${items.length - good} Again. Again comes back tomorrow.`}
      >
        <div>
          <Button kind="primary" hint="↵" onClick={onLeave}>
            Back to the set
          </Button>
        </div>
      </Page>
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
    <Page
      title="Study"
      meta={`${i + 1} of ${items.length}`}
      crumb={
        <Button kind="text" onClick={onLeave}>
          ← {title}
        </Button>
      }
    >
      <StudyCard
        kicker={it.kicker}
        face={
          shown ? (
            it.front
          ) : (
            <>
              {it.front}
              <Field
                label="Your answer"
                placeholder="Your answer, in your words"
                value={attempt}
                onChange={(e) => setAttempt(e.target.value)}
              />
            </>
          )
        }
        answer={
          shown ? (
            <>
              <EvLine quiet>
                {attempt
                  ? `You wrote: ${attempt}`
                  : "Logged: you asked to see it first."}
              </EvLine>
              {it.back}
              {it.note ? <EvLine quiet>{it.note}</EvLine> : null}
            </>
          ) : undefined
        }
        from={it.from}
        onTurn={() => attempt.trim() && setShown(true)}
        onJustTell={() => void tell()}
        onRate={rate}
      />
    </Page>
  );
}
