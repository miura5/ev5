import { useState } from "react";
import { Toast } from "../../kit/index.ts";
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
  const { data, token, refused, error, alert, tick, addPlan, addDate } =
    useToday(services?.readCopy);
  const [notSaved, setNotSaved] = useState(false);
  // No token, or one the server refused: the shell's token screen asks for it; show nothing, never an empty day.
  if (!token || refused) return null;
  // First data still on its way: the heading and a loading line, never an empty pane.
  if (!data && !error)
    return (
      <div className="ev-today" data-area="today">
        <header className="ev-today-top">
          <div className="ev-today-head">
            <h1 className="ev-today-title">Today</h1>
            <span className="ev-today-meta">{dateLabel()}</span>
          </div>
          <span className="ev-today-meta">Loading…</span>
        </header>
      </div>
    );
  return (
    <>
      {error ? <Toast message={error} /> : null}
      {notSaved ? <Toast message="Not saved. Try again." /> : null}
      <TodayView
        dateLabel={dateLabel()}
        {...(data ?? EMPTY)}
        alert={alert}
        onStartNext={none}
        onOpen={none}
        onTick={(id, done) =>
          void tick(id, done).then((ok) => setNotSaved(!ok))
        }
        onAddPlan={(title) =>
          addPlan(title).then((ok) => {
            setNotSaved(!ok);
            return ok;
          })
        }
        onAddDate={(title, date) =>
          addDate(title, date).then((ok) => {
            setNotSaved(!ok);
            return ok;
          })
        }
        onAccept={none}
        onEdit={none}
        onDismiss={none}
      />
    </>
  );
}
