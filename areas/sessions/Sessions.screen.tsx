import { useEffect, useState } from "react";
import { SessionView } from "./Sessions.view.tsx";
import { useSessions } from "./useSessions.ts";

const none = () => undefined;

/** The mounted view: the running (else latest) session from /api/v1/docs; pause and End act on this screen only. */
export function SessionsScreen() {
  const { data, token, error, setToken } = useSessions();
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState(0);
  const [paused, setPaused] = useState<boolean>();
  const [closed, setClosed] = useState(false);
  const stopped = (paused ?? data?.paused ?? false) || !!data?.ended || closed;
  useEffect(() => {
    if (stopped || !data) return;
    const t = setInterval(() => setExtra((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [stopped, data]);
  if (!token)
    return (
      <form
        className="ev-session"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setToken(draft.trim());
        }}
      >
        <label className="ev-session-meta" htmlFor="ev-token">
          Paste your app token to see Sessions
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
      {error ? <p className="ev-session-meta">{error}</p> : null}
      {closed ? (
        <p className="ev-session-meta">
          Closed on this screen; nothing was saved.
        </p>
      ) : (
        <SessionView
          title={data?.title ?? "Study session"}
          meta={data?.meta ?? "no session yet"}
          seconds={(data?.seconds ?? 0) + (data ? extra : 0)}
          paused={paused ?? data?.paused ?? false}
          checks={[]}
          onTogglePause={() => setPaused(!(paused ?? data?.paused ?? false))}
          onEnd={() => setClosed(true)}
          onToggleCheck={none}
          onAnswer={none}
          onTellMe={none}
        />
      )}
    </>
  );
}
