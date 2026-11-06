import { Bars, Empty, Page, Section } from "../../kit/index.ts";
import "./progress.css";
import { endedMinutesText, minutesText, trendText } from "./text.ts";
import { useProgress } from "./useProgress.ts";
import type { ReadCopyLike } from "../../commands/client.ts";

const EMPTY =
  "Your accuracy over time will show here once you have answered some practice questions.";

/** Progress: weekly first-try accuracy and the last week's minutes, each with its big number and bars (read-only, no writes). */
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
    <Page title="Progress" meta="last 8 weeks">
      {error ? <Empty line={error} /> : null}
      {data?.accuracy ? (
        <Section label="Retrieval accuracy">
          <div className="ev-progress-body">
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
        </Section>
      ) : null}
      {token && !data && !error ? <Empty line="Loading…" /> : null}
      {data && !error && !data.accuracy && !data.hasAnswers ? (
        <Empty line={EMPTY} />
      ) : null}
      {data && data.sessions > 0 ? (
        <Section label="Minutes, last 7 days">
          <div className="ev-progress-body">
            <div className="ev-progress-big">
              <span className="ev-progress-num">
                {minutesText(data.week.minutes)}
              </span>
              <span className="ev-progress-meta">
                {data.week.sessions}{" "}
                {data.week.sessions === 1 ? "session" : "sessions"}
                {data.sessions > data.week.sessions
                  ? ` · ${endedMinutesText(data.minutes, data.sessions)} in all`
                  : null}
              </span>
            </div>
            <Bars label="Minutes by day" bars={data.days} />
          </div>
        </Section>
      ) : null}
    </Page>
  );
}
