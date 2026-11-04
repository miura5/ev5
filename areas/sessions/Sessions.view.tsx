import type { ReactNode, Ref } from "react";
import { Button, Choice, Doc, EvLine, TextArea } from "../../kit/index.ts";
import "./sessions.css";

export interface SessionCheck {
  id: string;
  text: string;
  done: boolean;
}

export interface SessionViewProps {
  title: string;
  meta?: string;
  /** Seconds the session has run. */
  seconds: number;
  paused: boolean;
  /** The one check question E.V. asks in her own words; absent when none is open. */
  question?: string;
  /** What "Just tell me" reveals, once it is logged. */
  answer?: string;
  checks: readonly SessionCheck[];
  /** The session's root, so the screen can focus it. */
  rootRef?: Ref<HTMLElement>;
  /** The note's blocks. */
  children?: ReactNode;
  onTogglePause: () => void;
  onEnd: () => void;
  onToggleCheck: (id: string) => void;
  onAnswer: (answer: string) => void;
  onTellMe: () => void;
}

/** 18:20 style timer. */
export function formatTimer(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** A study session over a note: the bar (timer, read-along, Pause, End), the page, a check, and the note's checks. */
export function SessionView(p: SessionViewProps) {
  return (
    <section
      className="ev-session"
      aria-label="Study session"
      ref={p.rootRef}
      tabIndex={-1}
    >
      <div className="ev-session-bar" data-ui="session-bar">
        <i
          className={
            p.paused ? "ev-session-dot ev-session-dot-paused" : "ev-session-dot"
          }
          aria-hidden="true"
        />
        <span>
          Session <span data-ui="timer">{formatTimer(p.seconds)}</span>
        </span>
        <span className="ev-session-meta">read-along on</span>
        <span className="ev-session-grow" />
        <Button kind="text" onClick={p.onTogglePause} hint="Space">
          {p.paused ? "Resume" : "Pause"}
        </Button>
        <Button kind="secondary" onClick={p.onEnd}>
          End
        </Button>
      </div>
      <Doc title={p.title} meta={p.meta}>
        {p.children}
        {p.question ? (
          <CheckBlock
            question={p.question}
            answer={p.answer}
            onAnswer={p.onAnswer}
            onTellMe={p.onTellMe}
          />
        ) : null}
        {p.checks.length > 0 ? (
          <ul className="ev-session-checks" aria-label="Checks">
            {p.checks.map((c) => (
              <li
                key={c.id}
                className={
                  c.done
                    ? "ev-session-check ev-session-check-done"
                    : "ev-session-check"
                }
              >
                <Choice
                  kind="checkbox"
                  checked={c.done}
                  onChange={() => p.onToggleCheck(c.id)}
                >
                  {c.text}
                </Choice>
              </li>
            ))}
          </ul>
        ) : null}
      </Doc>
    </section>
  );
}

function CheckBlock(p: {
  question: string;
  answer?: string;
  onAnswer: (a: string) => void;
  onTellMe: () => void;
}) {
  return (
    <form
      className="ev-session-check-block"
      data-ui="check-block"
      onSubmit={(e) => {
        e.preventDefault();
        const field = e.currentTarget.elements.namedItem(
          "answer",
        ) as HTMLTextAreaElement;
        const text = field.value.trim();
        if (text) p.onAnswer(text);
      }}
    >
      <EvLine quiet>
        <b>Check, in your own words.</b> {p.question}
      </EvLine>
      <TextArea
        name="answer"
        rows={2}
        placeholder="Your words"
        label="Your answer"
      />
      {p.answer ? (
        <EvLine>
          <b>Logged: you asked to see it.</b> {p.answer}
        </EvLine>
      ) : null}
      <div className="ev-session-actions">
        <Button kind="primary" type="submit">
          Check
        </Button>
        <Button kind="text" onClick={p.onTellMe} title="Just tell me · logged">
          Just tell me
        </Button>
      </div>
    </form>
  );
}
