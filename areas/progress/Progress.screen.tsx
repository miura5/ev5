import "./progress.css";
import { endedMinutesText } from "./text.ts";
import { useProgress } from "./useProgress.ts";
import type { ReadCopyLike } from "../../commands/client.ts";

const EMPTY =
  "Your accuracy over time will show here once you have answered some practice questions.";

/** Progress: the same first-try accuracy line as Library, and the minutes of ended sessions (read-only, no writes). */
export function ProgressScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { data, token, refused, error } = useProgress(services?.readCopy);
  // No token, or one the server refused: the shell's token screen asks for it.
  if (token && refused) return null;
  return (
    <section className="ev-progress" data-ui="progress">
      <div className="ev-progress-head">
        <h1 className="ev-progress-title">Progress</h1>
        <span className="ev-progress-meta">accuracy over time</span>
      </div>
      {error ? <p className="ev-progress-line">{error}</p> : null}
      {data?.accuracy ? (
        <p className="ev-progress-line">
          <span className="ev-progress-meta">
            First-try accuracy, last 14 days
          </span>{" "}
          <span>{data.accuracy}</span>
        </p>
      ) : null}
      {!error && !data?.accuracy && !(data && data.hasAnswers) ? (
        <p className="ev-progress-line">{EMPTY}</p>
      ) : null}
      {data && data.sessions > 0 ? (
        <p className="ev-progress-line">
          <span className="ev-progress-meta">Study sessions</span>{" "}
          <span>{endedMinutesText(data.minutes, data.sessions)}</span>
        </p>
      ) : null}
    </section>
  );
}
