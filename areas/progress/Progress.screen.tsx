import { Bars } from "../../kit/index.ts";
import "./progress.css";
import { endedMinutesText, minutesText, trendText } from "./text.ts";
import { useProgress } from "./useProgress.ts";
import type { ReadCopyLike } from "../../commands/client.ts";

const EMPTY =
  "Your accuracy over time will show here once you have answered some practice questions.";

/** Progress: weekly first-try accuracy and the last week's study minutes, each with its big number and bars (read-only, no writes). */
export function ProgressScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { data, token, refused, error } = useProgress(services?.readCopy);
  // No token, or one the server refused: the shell's token screen asks for it.
  if (token && refused) return null;
  const [percent, ...trend] = (data?.accuracy ?? "").split(", ");
  return (
    <section className="ev-progress" data-ui="progress">
      <div className="ev-progress-head">
        <h1 className="ev-progress-title">Progress</h1>
        <span className="ev-progress-meta">last 8 weeks</span>
      </div>
      {error ? <p className="ev-progress-line">{error}</p> : null}
      {data?.accuracy ? (
        <div className="ev-progress-sec">
          <h2 className="ev-progress-label">Retrieval accuracy</h2>
          <div className="ev-progress-big">
            <span className="ev-progress-num">{percent}</span>
            <span className="ev-progress-meta">
              {[
                "first try, from memory",
                ...trend.map((t) => trendText(percent ?? "", t)),
              ].join(" · ")}
            </span>
          </div>
          <Bars
            label="First-try accuracy by week"
            bars={data.weeks}
            max={100}
          />
        </div>
      ) : null}
      {!error && !data?.accuracy && !(data && data.hasAnswers) ? (
        <p className="ev-progress-line">{EMPTY}</p>
      ) : null}
      {data && data.sessions > 0 ? (
        <div className="ev-progress-sec">
          <h2 className="ev-progress-label">Study minutes, last 7 days</h2>
          <div className="ev-progress-big">
            <span className="ev-progress-num">
              {minutesText(data.week.minutes)}
            </span>
            <span className="ev-progress-meta">
              {data.week.sessions}{" "}
              {data.week.sessions === 1 ? "session" : "sessions"}
              {" · "}
              {endedMinutesText(data.minutes, data.sessions)} in all
            </span>
          </div>
          <Bars label="Study minutes by day" bars={data.days} />
        </div>
      ) : null}
    </section>
  );
}
