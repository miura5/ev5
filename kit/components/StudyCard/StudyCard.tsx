import type { ReactNode } from "react";
import { Button } from "../Button/Button";
import { Source } from "../Source/Source";

export interface StudyCardProps {
  /** What the face is: Term, Question, Step 2. */
  kicker: string;
  /** The face; large for a short term, body size for a long question. */
  face: ReactNode;
  /** The back. While it is absent the card waits for the attempt. */
  answer?: ReactNode;
  /** Where the answer came from; leave out for "unverified". Shown with the answer. */
  from?: string;
  /** The set's hero card: click or Space flips it, the arrows move. */
  hero?: {
    position: number;
    total: number;
    onFlip: () => void;
    onPrev: () => void;
    onNext: () => void;
  };
  /** Study: the attempt is written on the card, then Turn over. */
  onTurn?: () => void;
  onJustTell?: () => void;
  onRate?: (rating: "again" | "good") => void;
}

/** A card: one thing in focus. In study the attempt comes first; as the hero it flips freely. */
export function StudyCard({
  kicker,
  face,
  answer,
  from,
  hero,
  onTurn,
  onJustTell,
  onRate,
}: StudyCardProps) {
  const revealed = answer !== undefined;
  const pos = hero ? `${hero.position} / ${hero.total}` : null;
  const card = (
    <div
      className={hero ? "kit-card kit-card-hero" : "kit-card"}
      data-ui="study-card"
      data-flipped={revealed ? "true" : "false"}
      tabIndex={hero ? 0 : undefined}
      onClick={hero?.onFlip}
      onKeyDown={
        hero
          ? (e) => {
              if (e.key === " ") {
                e.preventDefault();
                hero.onFlip();
              } else if (e.key === "ArrowLeft") hero.onPrev();
              else if (e.key === "ArrowRight") hero.onNext();
            }
          : undefined
      }
    >
      <div className="kit-card-head">
        <span className="kit-card-meta">
          {revealed && hero ? "Answer" : kicker}
        </span>
        {pos ? <span className="kit-card-meta">{pos}</span> : null}
      </div>
      {revealed ? (
        <div className="kit-card-reveal">
          {hero ? null : <div className="kit-card-face">{face}</div>}
          <div className="kit-card-answer">{answer}</div>
          <Source from={from} />
        </div>
      ) : (
        <div className="kit-card-face">{face}</div>
      )}
      {!hero ? (
        <div className="kit-card-foot">
          {revealed ? (
            <>
              <Button onClick={() => onRate?.("again")} hint="1">
                Again
              </Button>
              <Button onClick={() => onRate?.("good")} hint="2">
                Good
              </Button>
            </>
          ) : (
            <>
              <Button kind="primary" onClick={onTurn} hint="↵">
                Turn over
              </Button>
              <Button
                kind="text"
                onClick={onJustTell}
                title="Just tell me, logged"
              >
                Just tell me
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
  if (!hero) return card;
  return (
    <div data-ui="study-hero">
      {card}
      <div className="kit-card-nav">
        <Button kind="icon" aria-label="Previous" onClick={hero.onPrev}>
          ‹
        </Button>
        <Button kind="icon" aria-label="Next" onClick={hero.onNext}>
          ›
        </Button>
      </div>
    </div>
  );
}
