import { useState } from "react";
import { TodayView } from "./Today.view.tsx";
import { useToday, type ReadCopyLike } from "./useToday.ts";

const none = () => undefined;
const dateLabel = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
const EMPTY = {
  say: {
    lead: "Nothing planned yet.",
    rest: "Your plan for today will appear here.",
  },
  plan: [],
  upcoming: [],
  thisWeek: [],
};

/** The mounted view: exams, weak spots and today's plan from /api/v1/docs; no data shows the empty day. */
export function TodayScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { data, error, alert, tick } = useToday(services?.readCopy);
  const [notSaved, setNotSaved] = useState(false);
  // No data and no failure yet (loading, or the shell's token screen is up): show nothing, never an empty day.
  if (!data && !error) return null;
  return (
    <>
      {error ? (
        <p className="ev-today-meta" role="status">
          {error}
        </p>
      ) : null}
      {notSaved ? <p className="ev-today-meta">Not saved. Try again.</p> : null}
      <TodayView
        dateLabel={dateLabel()}
        {...(data ?? EMPTY)}
        alert={alert}
        onStartNext={none}
        onOpen={none}
        onTick={(id, done) =>
          void tick(id, done).then((ok) => setNotSaved(!ok))
        }
        onAccept={none}
        onEdit={none}
        onDismiss={none}
      />
    </>
  );
}
