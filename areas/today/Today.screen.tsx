import { useEffect, useRef, useState } from "react";
import { longDay } from "../../domain/index.ts";
import { Empty, Page, type DetailProps } from "../../kit/index.ts";
import { examDetail } from "./ExamDetail.tsx";
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
  onDetail,
  onToast,
}: {
  services?: { readCopy?: ReadCopyLike };
  onNavigate?: (path: string) => void;
  onDetail?: (detail: DetailProps | null) => void;
  onToast?: (message: string) => void;
}) {
  const {
    data,
    token,
    refused,
    error,
    alert,
    tick,
    addPlan,
    addDate,
    planWithEv,
  } = useToday(services?.readCopy);
  const notSaved = (ok: boolean) => {
    if (!ok) onToast?.("Not saved. Try again.");
  };
  const [openId, setOpenId] = useState<string>();
  // Bumped on every open, so the Detail shows again after the shell closed it with Esc.
  const [openKey, setOpenKey] = useState(0);
  const opened = data?.upcoming.find((d) => d.id === openId);
  // The exam's Detail lives in the shell's host; the shell closes it on Esc and when Matt leaves the screen.
  const last = useRef({ onNavigate, planWithEv, onToast });
  last.current = { onNavigate, planWithEv, onToast };
  useEffect(() => {
    if (!onDetail) return;
    if (!opened) return onDetail(null);
    const go = last.current.onNavigate;
    onDetail(
      examDetail(opened, {
        onReviewPlan: go
          ? () => go(`/library?open=${encodeURIComponent(opened.id)}`)
          : undefined,
        onPlanWithEv: () =>
          void last.current
            .planWithEv(opened.id)
            .then((ok) =>
              last.current.onToast?.(
                ok ? "E.V. is drafting a plan" : "Not saved. Try again.",
              ),
            ),
        onClose: () => setOpenId(undefined),
      }),
    );
  }, [opened, openKey, onDetail]);
  useEffect(() => {
    if (error && token && !refused) onToast?.(error);
  }, [error, token, refused, onToast]);
  // No token, or one the server refused: the shell's token screen asks for it; show nothing, never an empty day.
  if (!token || refused) return null;
  // First data still on its way: the heading and a loading line, never an empty pane.
  if (!data && !error)
    return (
      <Page title="Today" meta={dateLabel()}>
        <Empty line="Loading…" />
      </Page>
    );
  const view = data ?? EMPTY;
  const upcoming = view.upcoming;
  return (
    <>
      <TodayView
        dateLabel={dateLabel()}
        {...view}
        upcoming={upcoming}
        selectedId={opened?.id}
        alert={alert}
        onStartNext={() => {
          const first = view.plan.find((p) => !p.done);
          onToast?.(
            first ? `Started · ${first.title}` : "Nothing left on today's plan",
          );
        }}
        onOpen={(id) => {
          if (!upcoming.some((d) => d.id === id)) return setOpenId(undefined);
          setOpenId(id);
          setOpenKey((k) => k + 1);
        }}
        onTick={(id, done) =>
          void tick(id, done).then((ok) => notSaved(ok))
        }
        onAddPlan={(title) =>
          addPlan(title).then((ok) => {
            notSaved(ok);
            return ok;
          })
        }
        onAddDate={(title, date) =>
          addDate(title, date).then((ok) => {
            notSaved(ok);
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
