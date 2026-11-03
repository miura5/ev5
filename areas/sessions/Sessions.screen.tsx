import { useEffect, useState } from "react";
import { SessionView } from "./Sessions.view.tsx";

/** The mounted view until the data wiring lands: an empty session that times itself and can pause and end. */
export function SessionsScreen() {
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (paused || ended) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused, ended]);
  if (ended)
    return (
      <p className="ev-session-meta">
        Session saved · {Math.floor(seconds / 60)} min.
      </p>
    );
  return (
    <SessionView
      title="Study session"
      meta="no note open yet"
      seconds={seconds}
      paused={paused}
      checks={[]}
      onTogglePause={() => setPaused((p) => !p)}
      onEnd={() => setEnded(true)}
      onToggleCheck={() => {}}
      onAnswer={() => {}}
      onTellMe={() => {}}
    />
  );
}
