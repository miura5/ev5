import type { ReactNode } from "react";
import { Button } from "../Button/Button";

export interface DocCheck {
  id: string;
  text: string;
  done: boolean;
}

export interface DocSession {
  /** What the session is, e.g. "Studying · Supply and demand". */
  label: string;
  onLeave: () => void;
  checks: DocCheck[];
  onToggle: (id: string) => void;
}

export interface DocProps {
  title: string;
  /** One quiet line under the title. */
  meta?: string;
  /** The note's blocks. */
  children?: ReactNode;
  /** Present only during a session: the bar and the checks. */
  session?: DocSession;
}

/** The note page: one centred column. A session adds a bar on top and the checks below the title. */
export function Doc({ title, meta, children, session }: DocProps) {
  return (
    <div className="kit-doc" data-ui="doc">
      {session ? (
        <div className="kit-doc-bar" data-ui="doc-session">
          <span className="kit-doc-bar-label">{session.label}</span>
          <Button kind="text" onClick={session.onLeave} hint="Esc">
            Leave
          </Button>
        </div>
      ) : null}
      <article className="kit-doc-page">
        <h1 className="kit-doc-title">{title}</h1>
        {meta ? <div className="kit-doc-meta">{meta}</div> : null}
        {session ? (
          <ul className="kit-doc-checks" aria-label="Checks">
            {session.checks.map((c) => (
              <li
                key={c.id}
                className={
                  c.done ? "kit-doc-check kit-doc-check-done" : "kit-doc-check"
                }
              >
                <label>
                  <input
                    className="kit-doc-check-in"
                    type="checkbox"
                    checked={c.done}
                    onChange={() => session.onToggle(c.id)}
                  />
                  <span className="kit-doc-check-box" aria-hidden="true" />
                  {c.text}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="kit-doc-body">{children}</div>
      </article>
    </div>
  );
}
