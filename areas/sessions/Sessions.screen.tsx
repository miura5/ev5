import { useEffect, useRef, useState } from "react";
import { sessionState, parseSession } from "../../domain/index.ts";
import { withEnd, withPause, withTellMe } from "./events.ts";
import { NoteBlocks } from "./NoteBlocks.tsx";
import { SessionView } from "./Sessions.view.tsx";
import { useSessions } from "./useSessions.ts";

const none = () => undefined;
const rand = () => Math.random().toString(36).slice(2, 6).padEnd(4, "0");

/** The mounted view: the running (else latest) session from /api/v1/docs; pause and End act on this screen only. */
export function SessionsScreen() {
  const { data, token, error, setToken, note, save } = useSessions();
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState(0);
  const [closed, setClosed] = useState(false);
  const [saved, setSaved] = useState(false);
  const paused = data?.paused ?? false;
  const stopped = paused || !!data?.ended || closed;
  const togglePause = () => {
    if (!data || data.ended) return;
    void save(withPause(data.raw, !paused, new Date(), rand()));
  };
  // One append-only event on the session; the screen has no open check yet, so no answer is shown (Sessions.view answer).
  const tellMe = async () => {
    if (data && !data.ended)
      await save(withTellMe(data.raw, new Date(), rand()));
  };
  const end = async () => {
    if (!data || data.ended) return setClosed(true);
    const now = new Date();
    const doc = parseSession(data.raw);
    const minutes = sessionState(
      { ...doc, id: data.id },
      now.getTime(),
    ).minutes;
    if (await save(withEnd(data.raw, minutes, now, rand()))) setSaved(true);
  };
  // Space pauses or resumes unless he is typing or on a control; Esc leaves the field he is typing in.
  const act = useRef({ togglePause });
  act.current = { togglePause };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName);
      if (e.key === "Escape" && typing) return t.blur();
      if (e.key === " " && !typing && !e.repeat) {
        e.preventDefault();
        act.current.togglePause();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    setExtra(0);
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
      {saved ? <p className="ev-session-meta">Saved to Progress.</p> : null}
      {closed ? (
        <p className="ev-session-meta">
          Closed on this screen; nothing was saved.
        </p>
      ) : (
        <SessionView
          title={data?.title ?? "Study session"}
          meta={data?.meta ?? "no session yet"}
          seconds={(data?.seconds ?? 0) + (data ? extra : 0)}
          paused={paused}
          checks={[]}
          onTogglePause={togglePause}
          onEnd={() => void end()}
          onToggleCheck={none}
          onAnswer={none}
          onTellMe={() => void tellMe()}
        >
          {note ? <NoteBlocks blocks={note.blocks} /> : null}
        </SessionView>
      )}
    </>
  );
}
