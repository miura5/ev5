import { useEffect, useRef, useState } from "react";
import { Empty, Page, type DetailProps } from "../../kit/index.ts";
import { LibraryView } from "./Library.view.tsx";
import { StudyView } from "./Study.view.tsx";
import { datePlanDetail } from "./DatePlan.detail.tsx";
import { weakSpotDetail } from "./WeakSpot.detail.tsx";
import { SetPageView } from "./SetPage.view.tsx";
import { useLibrary } from "./useLibrary.ts";
import {
  useGrade,
  useStudy,
  useTellMe,
  type LibraryServices,
} from "./useStudy.ts";

/** The id the palette asks to open: /library?open=<id> (shell/findings.ts); anything else is nothing. */
function openFromSearch(search = ""): string | undefined {
  return new URLSearchParams(search).get("open") || undefined;
}

const PLAN_TEXT = {
  none: "no plan yet",
  draft: "draft waiting for you",
  approved: "in force",
  ended: "ended",
  away: "put away",
  working: "E.V. is saving the plan",
} as const;

/** The mounted view: goals, weak spots and sets from their row routes; opening a set shows its page. */
export function LibraryScreen({
  services,
  search,
  onNavigate,
  onDetail,
  onToast,
}: {
  services?: LibraryServices;
  search?: string;
  onNavigate?: (path: string) => void;
  onDetail?: (detail: DetailProps | null) => void;
  onToast?: (message: string) => void;
}) {
  const { data, token, refused, error, runPlan, setKind, linkSpot, answerPlan } =
    useLibrary(services?.readCopy);
  const setPlanNote = (message: string) => onToast?.(message);
  useEffect(() => {
    if (error && token && !refused) onToast?.(error);
  }, [error, token, refused, onToast]);
  // Answers the server turned down for good stay on this device; say so once instead of leaving them unseen.
  const waiting = services?.outbox.waiting;
  const told = useRef(false);
  useEffect(() => {
    if (!waiting || told.current) return;
    told.current = true;
    void waiting
      .call(services?.outbox)
      .then((all) => {
        const bad = all.filter((e) => e.refused);
        if (bad.length)
          onToast?.(
            `${bad.length} answer${bad.length === 1 ? " was" : "s were"} not saved: ${bad[0]?.refused ?? ""}`,
          );
      })
      .catch(() => undefined);
  }, [waiting, services, onToast]);
  // The open set is the shell's address (?open=), so Back and Forward move between the list and a set.
  const open = openFromSearch(search);
  const setOpen = (id: string | undefined) =>
    onNavigate?.(id ? `/library?open=${encodeURIComponent(id)}` : "/library");
  // Bumped on every open, so the Detail shows again after the shell closed it with Esc.
  const [openKey, setOpenKey] = useState(0);
  const openIt = (id: string) => {
    setOpen(id);
    setOpenKey((k) => k + 1);
  };
  // An exam opened by a link (Today's Review the prep plan) shows its proposal at once.
  const [openedByLink] = useState(() => !!openFromSearch(search));
  const [studying, setStudying] = useState(false);
  // Back or Forward to another set (or the list) never lands inside a study run.
  useEffect(() => setStudying(false), [open]);
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
  // A kind that was saved says nothing (the Detail shows it); one that was not says why.
  const kind = async (id: string, k: string) => {
    const why = await setKind(id, k);
    if (why) setPlanNote(why);
  };
  // A date change that was saved says nothing (the Detail shows it); one that was not says why.
  const link = async (id: string, from: string | null, to: string | null) => {
    const why = await linkSpot(id, from, to);
    if (why) setPlanNote(why);
  };
  const last = useRef({ plan, answer, kind, link });
  last.current = { plan, answer, kind, link };
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
        datePlanDetail({
          exam: {
            id: exam.id,
            title: exam.title,
            when: exam.when,
            kind: exam.kind,
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
              : last.current.plan("plan.approve", { id }, "Plan approved")),
          onAskChanges: (id, note) =>
            void last.current.plan(
              "plan.ask_changes",
              { id, note },
              "Changes sent",
            ),
          onPutAway: (id) =>
            void (exam.waiting
              ? last.current.answer(id, "put_away")
              : last.current.plan("plan.put_away", { id }, "Plan put away")),
          onKind: (k) => void last.current.kind(exam.id, k),
          onClose: close,
        }),
      );
    if (spot)
      onDetail(
        weakSpotDetail({
          spot,
          dates: data?.exams ?? [],
          onLink: (to) => void last.current.link(spot.id, spot.goalId, to),
          onClose: close,
        }),
      );
  }, [page, exam, spot, data?.exams, openedByLink, openKey, onDetail]);
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
          ...(it.options ? { options: it.options, multi: !!it.multi } : {}),
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
        initialTab={openedByLink && exam ? "dates" : undefined}
      />
    </>
  );
}
