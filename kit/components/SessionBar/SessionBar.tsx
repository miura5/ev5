import { Button } from "../Button/Button";
import { Dot } from "../Dot/Dot";

export interface SessionBarProps {
  /** The running time, such as "18:20". The caller keeps the clock. */
  timer: string;
  /** True while the session is paused: the dot goes quiet and the action reads Resume. */
  paused?: boolean;
  /** True when the read-along is on; shown as a quiet note. */
  readAlong?: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}

/** The bar on top of a note while a session runs: the clock, the read-along note, Pause and End. */
export function SessionBar({ timer, paused = false, readAlong = false, onTogglePause, onEnd }: SessionBarProps) {
  return (
    <div className="kit-sessionbar" data-ui="session-bar" data-paused={paused ? "true" : undefined}>
      <Dot tone={paused ? "faint" : "info"} />
      <span className="kit-sessionbar-timer">
        Session <span data-ui="session-timer">{timer}</span>
      </span>
      {readAlong ? <span className="kit-sessionbar-note">read-along on</span> : null}
      <span className="kit-sessionbar-grow" />
      <Button kind="text" hint="Space" title="Pause or resume (Space when not typing)" onClick={onTogglePause}>
        {paused ? "Resume" : "Pause"}
      </Button>
      <Button kind="secondary" title="End session" onClick={onEnd}>
        End
      </Button>
    </div>
  );
}
