import { useState, type ReactNode, type Ref } from "react";
import {
  Choice,
  Doc,
  EvLine,
  SessionBar,
  StudyCard,
  TextArea,
} from "../../kit/index.ts";
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

/** A session over a note: the bar (timer, read-along, Pause, End), the page, a check, and the note's checks. */
export function SessionView(p: SessionViewProps) {
  return (
    <section
      className="ev-session"
      aria-label="Session"
      ref={p.rootRef}
      tabIndex={-1}
    >
      <SessionBar
        timer={formatTimer(p.seconds)}
        paused={p.paused}
        readAlong
        onTogglePause={p.onTogglePause}
        onEnd={p.onEnd}
      />
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
  const [text, setText] = useState("");
  return (
    <div data-ui="check-block">
      <StudyCard
        kicker="Check, in your own words"
        face={
          <>
            <EvLine quiet>{p.question}</EvLine>
            <TextArea
              rows={2}
              placeholder="Your words"
              label="Your answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </>
        }
        onTurn={() => {
          const t = text.trim();
          if (t) p.onAnswer(t);
        }}
        onJustTell={p.onTellMe}
      />
      {p.answer ? (
        <EvLine>
          <b>Logged: you asked to see it.</b> {p.answer}
        </EvLine>
      ) : null}
    </div>
  );
}
