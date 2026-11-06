import { useEffect, useRef, useState } from "react";
import { Empty, Page, type DetailProps } from "../../kit/index.ts";
import { LibraryView } from "./Library.view.tsx";
import { StudyView } from "./Study.view.tsx";
import { examPlanDetail } from "./ExamPlan.detail.tsx";
import { SetPageView } from "./SetPage.view.tsx";
import { useLibrary } from "./useLibrary.ts";
import {
  useGrade,
  useStudy,
  useTellMe,
  type LibraryServices,
} from "./useStudy.ts";

/** The id the palette asks to open: /library?open=<id> (shell/findings.ts); anything else is nothing. */
function openFromUrl(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get("open") || undefined;
  } catch {
    return undefined;
  }
}

const PLAN_TEXT = {
  none: "no plan yet",
  draft: "draft waiting for you",
  approved: "in force",
  ended: "ended",
  away: "put away",
  working: "E.V. is saving the plan",
} as const;

/** The mounted view: exams, weak spots and sets from /api/v1/docs; opening a set shows its page. */
export function LibraryScreen({
  services,
  onDetail,
  onToast,
}: {
  services?: LibraryServices;
  onDetail?: (detail: DetailProps | null) => void;
  onToast?: (message: string) => void;
}) {
  const { data, token, refused, error, runPlan, answerPlan } = useLibrary(
    services?.readCopy,
  );
  const setPlanNote = (message: string) => onToast?.(message);
  useEffect(() => {
    if (error && token && !refused) onToast?.(error);
  }, [error, token, refused, onToast]);
  const [open, setOpen] = useState<string | undefined>(openFromUrl);
  // Bumped on every open, so the Detail shows again after the shell closed it with Esc.
  const [openKey, setOpenKey] = useState(0);
  const openIt = (id: string) => {
    setOpen(id);
    setOpenKey((k) => k + 1);
  };
  // An exam opened by a link (Today's Review the study plan) shows its proposal at once.
  const [openedByLink] = useState(() => !!openFromUrl());
  const [studying, setStudying] = useState(false);
  const onRate = useStudy(open ?? "", services);
  const onTell = useTellMe(open ?? "", services);
  const onGrade = useGrade(open ?? "");
  // A plan answer that went through says so; one that did not says why.
  const plan = async (
    name: Parameters<typeof runPlan>[0],
    input: Record<string, string>,
    done: string,
  ) => setPlanNote((await runPlan(name, input)) ?? done);
  // A waiting plan is a job, not yet a document: approving or putting it away answers the job.
  const answer = async (id: string, decision: "approve" | "put_away") =>
    setPlanNote(
      (await answerPlan(id, decision)) ??
        (decision === "approve" ? "Plan approved" : "Plan put away"),
    );
  const last = useRef({ plan, answer });
  last.current = { plan, answer };
  const page = open ? data?.pages[open] : undefined;
  const exam = open ? data?.exams.find((x) => x.id === open) : undefined;
  const spot = open ? data?.weakSpots.find((w) => w.id === open) : undefined;
  // The exam's or weak spot's Detail lives in the shell's host; the shell closes it on Esc and when Matt leaves the screen.
  useEffect(() => {
    if (!onDetail) return;
    const close = () => setOpen(undefined);
    if (page || (!exam && !spot)) return onDetail(null);
    if (exam)
      return onDetail(
        examPlanDetail({
          exam: {
            id: exam.id,
            title: exam.title,
            when: exam.when,
            course: exam.course,
            readiness: exam.readiness || "none yet",
            plan: PLAN_TEXT[exam.planState ?? "none"],
            planState: exam.planState,
            planId: exam.planId,
            proposals: [],
            sessions: exam.sessions,
          },
          startOpen: openedByLink,
          onPlanWithEv: () =>
            void last.current.plan(
              "date.plan_with_ev",
              { id: exam.id },
              "E.V. is drafting a plan",
            ),
          onApprove: (id) =>
            void (exam.waiting
              ? last.current.answer(id, "approve")
              : last.current.plan(
                  "studyplan.approve",
                  { id },
                  "Plan approved",
                )),
          onAskChanges: (id, note) =>
            void last.current.plan(
              "studyplan.ask_changes",
              { id, note },
              "Changes sent",
            ),
          onPutAway: (id) =>
            void (exam.waiting
              ? last.current.answer(id, "put_away")
              : last.current.plan(
                  "studyplan.put_away",
                  { id },
                  "Plan put away",
                )),
          onClose: close,
        }),
      );
    if (spot)
      onDetail({
        title: spot.title,
        onClose: close,
        properties: [
          { label: "Course", value: spot.meta },
          { label: "Next", value: spot.due },
        ],
      });
  }, [page, exam, spot, openedByLink, openKey, onDetail]);
  // No token, or one the server refused: the shell's token screen asks for it; show nothing, never an empty library.
  if (!token || refused) return null;
  // First data still on its way: the heading and a loading line, never an empty pane.
  if (!data && !error)
    return (
      <Page title="Library">
        <Empty line="Loading…" />
      </Page>
    );
  if (page && studying)
    return (
      <StudyView
        title={page.title}
        items={page.items.map((it) => ({
          id: it.id,
          kicker: "Question",
          front: it.front,
          back: it.back ?? "",
          ...(it.open ? { open: true } : {}),
        }))}
        onRate={onRate}
        onTell={onTell}
        onGrade={onGrade}
        onLeave={() => setStudying(false)}
      />
    );
  if (page)
    return (
      <SetPageView
        set={page}
        onStudy={() => setStudying(true)}
        onBack={() => setOpen(undefined)}
      />
    );
  return (
    <>
      <LibraryView
        practice={null}
        weakSpots={data?.weakSpots ?? []}
        exams={data?.exams ?? []}
        sets={data?.sets ?? []}
        accuracy={data?.accuracy ?? null}
        onOpenSet={openIt}
        onOpenExam={openIt}
        onDrill={openIt}
        initialTab={openedByLink && exam ? "exams" : undefined}
      />
    </>
  );
}
