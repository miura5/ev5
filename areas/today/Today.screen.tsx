import { useState } from "react";
import { TodayView } from "./Today.view.tsx";
import { useToday } from "./useToday.ts";

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
export function TodayScreen() {
  const { data, token, error, alert, tick, setToken } = useToday();
  const [notSaved, setNotSaved] = useState(false);
  const [draft, setDraft] = useState("");
  if (!token)
    return (
      <form
        className="ev-today"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setToken(draft.trim());
        }}
      >
        <label className="ev-today-meta" htmlFor="ev-token">
          Paste your app token to see Today
        </label>
        <input
          id="ev-token"
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
    );
  return (
    <>
      {error ? <p className="ev-today-meta">{error}</p> : null}
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
