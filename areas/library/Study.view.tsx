import { useState } from "react";
import { Button, EvLine, Field, Page, StudyCard } from "../../kit/index.ts";
import type { StudyItem } from "./types.ts";
import type { GradeOutcome } from "./useStudy.ts";

export interface StudyViewProps {
  title: string;
  items: readonly StudyItem[];
  /** Called with each rating as it is given. */
  onRate?: (id: string, rating: "again" | "good", attempt: string) => void;
  /** Called when he taps "Just tell me"; the answer shows once this resolves true (an event is logged first). */
  onTell?: (id: string) => Promise<boolean>;
  /** Grades a typed answer to an open item (study.attempt); open items have no Again or Good. */
  onGrade?: (id: string, answer: string) => Promise<GradeOutcome>;
  onLeave?: () => void;
}

/** Study mode: one card, his attempt first, then the back with its source, then Again or Good. */
export function StudyView({
  title,
  items,
  onRate,
  onTell,
  onGrade,
  onLeave,
}: StudyViewProps) {
  const [i, setI] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [shown, setShown] = useState(false);
  const [good, setGood] = useState(0);
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState<GradeOutcome | null>(null);
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
  const gradeIt = async () => {
    if (!onGrade || grading || !attempt.trim()) return;
    setGrading(true);
    setGraded(null);
    const out = await onGrade(it.id, attempt);
    setGrading(false);
    setGraded(out);
    if (out.ok) setShown(true);
  };
  const next = () => {
    if (graded?.ok && graded.correct) setGood(good + 1);
    setI(i + 1);
    setAttempt("");
    setShown(false);
    setGraded(null);
  };
  const rate = (r: "again" | "good") => {
    onRate?.(it.id, r, attempt);
    if (r === "good") setGood(good + 1);
    setI(i + 1);
    setAttempt("");
    setShown(false);
  };
  const crumb = (
    <Button kind="text" onClick={onLeave}>
      ← {title}
    </Button>
  );
  // A graded open answer: the result and the back, then on. There is no self-rating to give.
  if (it.open && onGrade && graded?.ok)
    return (
      <Page title="Study" meta={`${i + 1} of ${items.length}`} crumb={crumb}>
        <EvLine>{it.front}</EvLine>
        <EvLine quiet>{`You wrote: ${attempt}`}</EvLine>
        <EvLine>
          {`${graded.correct ? "Good" : "Not yet"}: ${Math.round(graded.score * 100)}%${graded.note ? `. ${graded.note}` : ""}`}
        </EvLine>
        {it.back ? <EvLine quiet>{it.back}</EvLine> : null}
        <div>
          <Button kind="primary" hint="↵" onClick={next}>
            Next
          </Button>
        </div>
      </Page>
    );
  return (
    <Page title="Study" meta={`${i + 1} of ${items.length}`} crumb={crumb}>
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
              {grading ? <EvLine quiet>Grading your answer…</EvLine> : null}
              {graded && !graded.ok ? <EvLine>{graded.message}</EvLine> : null}
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
        onTurn={() =>
          it.open && onGrade ? void gradeIt() : attempt.trim() && setShown(true)
        }
        onJustTell={() => void tell()}
        onRate={rate}
      />
    </Page>
  );
}
