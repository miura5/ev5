import { useEffect, useState } from "react";
import { longDay } from "../../domain/index.ts";
import { Toast } from "../../kit/index.ts";
import { ExamDetail } from "./ExamDetail.tsx";
import { TodayView } from "./Today.view.tsx";
import { useToday, type ReadCopyLike } from "./useToday.ts";

const none = () => undefined;
const dateLabel = () => longDay(new Date());
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
  onNavigate,
}: {
  services?: { readCopy?: ReadCopyLike };
  onNavigate?: (path: string) => void;
}) {
  const { data, token, refused, error, alert, tick, addPlan, addDate } =
    useToday(services?.readCopy);
  const [notSaved, setNotSaved] = useState(false);
  const [openId, setOpenId] = useState<string>();
  // Esc closes the Detail panel.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);
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
  const view = data ?? EMPTY;
  const upcoming = view.upcoming;
  const opened = upcoming.find((d) => d.id === openId);
  return (
    <>
      {error ? <Toast message={error} /> : null}
      {notSaved ? <Toast message="Not saved. Try again." /> : null}
      <TodayView
        dateLabel={dateLabel()}
        {...view}
        upcoming={upcoming}
        selectedId={opened?.id}
        alert={alert}
        onStartNext={none}
        onOpen={(id) =>
          setOpenId((cur) =>
            upcoming.some((d) => d.id === id) && cur !== id ? id : undefined,
          )
        }
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
      {opened ? (
        <ExamDetail
          exam={opened}
          onReviewPlan={
            onNavigate
              ? () =>
                  onNavigate(`/library?open=${encodeURIComponent(opened.id)}`)
              : undefined
          }
          onClose={() => setOpenId(undefined)}
        />
      ) : null}
    </>
  );
}
