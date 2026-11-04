import { useEffect, useRef, useState } from "react";
import { Doc, Toast } from "../../kit/index.ts";
import { sessionState, parseSession } from "../../domain/index.ts";
import { withEnd, withPause, withTellMe } from "./events.ts";
import { NoteBlocks } from "./NoteBlocks.tsx";
import { SessionView } from "./Sessions.view.tsx";
import { useSessions, type ReadCopyLike } from "./useSessions.ts";

const none = () => undefined;
const rand = () => Math.random().toString(36).slice(2, 6).padEnd(4, "0");

/** The mounted view: the running (else latest) session from /api/v1/docs; pause and End act on this screen only. */
export function SessionsScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { data, token, refused, error, note, toggleTodo, save } = useSessions(
    services?.readCopy,
  );
  const root = useRef<HTMLElement | null>(null);
  const [extra, setExtra] = useState(0);
  const [closed, setClosed] = useState(false);
  const [saved, setSaved] = useState(false);
  const paused = data?.paused ?? false;
  const stopped = paused || !!data?.ended || closed;
  const togglePause = () => {
    if (!data || data.ended) return;
    void save((raw) => withPause(raw, !paused, new Date(), rand()));
  };
  // One append-only event on the session; the screen has no open check yet, so no answer is shown (Sessions.view answer).
  const tellMe = async () => {
    if (data && !data.ended)
      await save((raw) => withTellMe(raw, new Date(), rand()));
  };
  const end = async () => {
    if (!data || data.ended) return setClosed(true);
    const now = new Date();
    // Built on the latest stored document, so a pause just written is in it and its time is not counted.
    const ok = await save((raw) => {
      const minutes = sessionState(
        { ...parseSession(raw), id: data.id },
        now.getTime(),
      ).minutes;
      return withEnd(raw, minutes, now, rand());
    });
    if (ok) setSaved(true);
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
  // After Start session the old button is gone: focus the page so Space pauses without a click first.
  const shown = !!data && !closed;
  useEffect(() => {
    if (shown) root.current?.focus({ preventScroll: true });
  }, [shown]);
  useEffect(() => {
    setExtra(0);
    if (stopped || !data) return;
    const t = setInterval(() => setExtra((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [stopped, data]);
  // No token, or one the server refused: no data and no "no session yet"; the shell's token screen asks for it.
  if (!token || refused) return null;
  return (
    <>
      {error ? <Toast message={error} /> : null}
      {saved ? <p className="ev-session-meta">Saved to Progress.</p> : null}
      {closed ? (
        <p className="ev-session-meta">
          Closed on this screen; nothing was saved.
        </p>
      ) : !data ? (
        // No running session: the empty line only, no bar, Pause or End (design/mockup.html).
        <Doc title="Study session" meta="no session yet" />
      ) : (
        <SessionView
          // A session over a note is that note's page: its own title once, no session heading or date above it.
          title={note?.title || data.title}
          meta={note ? undefined : data.meta}
          seconds={data.seconds + extra}
          rootRef={root}
          paused={paused}
          checks={[]}
          onTogglePause={togglePause}
          onEnd={() => void end()}
          onToggleCheck={none}
          onAnswer={none}
          onTellMe={() => void tellMe()}
        >
          {note ? (
            <NoteBlocks
              blocks={note.blocks}
              onToggle={(i) => void toggleTodo(i)}
            />
          ) : null}
        </SessionView>
      )}
    </>
  );
}
