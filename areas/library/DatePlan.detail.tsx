import { useState } from "react";
import {
  DATE_KINDS,
  kindOffers,
  plainDay,
  weekdayShort,
} from "../../domain/index.ts";
import {
  Button,
  Empty,
  Row,
  Section,
  Segmented,
  Suggestion,
  TextArea,
  type DetailProps,
} from "../../kit/index.ts";
import type { ExamPlanData } from "./types.ts";
import "./library.css";

export interface ExamPlanDetailProps {
  exam: ExamPlanData;
  onReviewPlan?: () => void;
  onAccept?: (proposalId: string) => void;
  onEdit?: (proposalId: string) => void;
  onDismiss?: (proposalId: string) => void;
  onClose?: () => void;
  /** "Plan with E.V.": asks E.V. to draft a prep plan for this date (only a kind that offers one shows it). */
  onPlanWithEv?: () => void;
  /** The Kind picker: sets the date's kind (a key of the kind registry). */
  onKind?: (kind: string) => void;
  /** The draft plan's three answers: approve it, ask for changes (with his note), or put it away. */
  onApprove?: (planId: string) => void;
  onAskChanges?: (planId: string, note: string) => void;
  onPutAway?: (planId: string) => void;
  /** Opens with the proposal showing (the exam was opened by a link to review its plan). */
  startOpen?: boolean;
}

/** The registry's kinds as the picker words them ("exam" reads "Exam"); a kind outside the registry reads as "other". */
const KINDS = Object.keys(DATE_KINDS);
const word = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
const known = (k: string) => (Object.hasOwn(DATE_KINDS, k) ? k : "other");

/** The shell Detail for a date: its properties and kind, then the prep plan's actions where its kind offers one. */
export function datePlanDetail(p: ExamPlanDetailProps): DetailProps {
  const { exam } = p;
  return {
    title: exam.title,
    onClose: p.onClose,
    properties: [
      { label: "Date", value: exam.when },
      { label: "Readiness", value: exam.readiness },
      ...(plans(exam) ? [{ label: "Plan", value: exam.plan }] : []),
    ],
    // Keyed on the plan's state, so a new state starts the body fresh.
    children: <ExamPlanBody key={`${exam.id}:${exam.kind}:${exam.planState}`} {...p} />,
  };
}

/** A date shows the prep plan where its kind offers one, or where a plan was already made for it. */
function plans(exam: ExamPlanData): boolean {
  return (
    kindOffers(exam.kind, "prep-plan") ||
    (exam.planState !== undefined && exam.planState !== "none")
  );
}

/** What sits under the properties; it keeps its own open and asking state while the shell holds the panel. */
function ExamPlanBody({
  exam,
  onReviewPlan,
  onAccept,
  onEdit,
  onDismiss,
  onPlanWithEv,
  onApprove,
  onAskChanges,
  onPutAway,
  onKind,
  startOpen,
}: ExamPlanDetailProps) {
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [review, setReview] = useState(
    !!startOpen || exam.planState === "approved",
  );
  const draft = exam.planState === "draft" && exam.planId;
  const planId = exam.planId ?? "";
  const ended = exam.planState === "ended";
  const approved = exam.planState === "approved" || ended;
  const lastDay = exam.sessions?.at(-1)?.date;
  const count = exam.sessions?.length ?? 0;
  const kind = (
    <Section label="Kind">
      <Segmented
        label="Kind"
        options={KINDS.map(word)}
        value={word(known(exam.kind))}
        onChange={(v) => onKind?.(v.toLowerCase())}
      />
    </Section>
  );
  if (!plans(exam)) return kind;
  return (
    <>
      {kind}
      <Button
        onClick={() => {
          setReview((r) => !r);
          onReviewPlan?.();
        }}
      >
        Review the prep plan
      </Button>
      {exam.planState === "working" ? (
        <div data-part="working">
          <Empty line="E.V. is saving the plan…" />
        </div>
      ) : null}
      {ended ? (
        <div data-part="ended">
          <Empty
            line={`This plan ended${lastDay ? ` on ${plainDay(lastDay, lastDay)}` : ""}. Sessions that were not done are not carried over; ask E.V. to plan again.`}
          />
        </div>
      ) : approved ? (
        <div data-part="approved">
          <Empty
            line={
              count
                ? `Approved, ${count} ${count === 1 ? "session" : "sessions"} added to your plan`
                : "Approved"
            }
          />
        </div>
      ) : null}
      {review ? (
        <div data-part="proposal">
          <Section
            label={approved ? "Sessions in your plan" : "Proposed sessions"}
          >
            {exam.sessions?.length ? (
              exam.sessions.map((s, i) => (
                <Row
                  key={`${s.date}-${i}`}
                  title={s.title}
                  meta={`${weekdayShort(s.date)} ${plainDay(s.date, s.date)}`}
                  value={`${s.minutes}m`}
                />
              ))
            ) : (
              <Empty line="The sessions are not shown here yet." />
            )}
            <Empty line="Built from: this date and your weak spots for it" />
          </Section>
        </div>
      ) : null}
      {draft ? (
        <>
          <div className="ev-library-actions">
            <Button kind="primary" onClick={() => onApprove?.(planId)}>
              Approve
            </Button>
            <Button kind="secondary" onClick={() => setAsking((a) => !a)}>
              Ask for changes
            </Button>
            <Button kind="text" onClick={() => onPutAway?.(planId)}>
              Put away
            </Button>
          </div>
          {asking ? (
            <>
              <TextArea
                label="What should change?"
                placeholder="What should change?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                disabled={!note.trim()}
                onClick={() => {
                  onAskChanges?.(planId, note.trim());
                  setNote("");
                  setAsking(false);
                }}
              >
                Send changes
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      {!draft && exam.proposals.length === 0 && kindOffers(exam.kind, "prep-plan") ? (
        <Button kind="text" onClick={() => onPlanWithEv?.()}>
          Plan with E.V.
        </Button>
      ) : null}
      {exam.proposals.length > 0 ? (
        <Section label="E.V. suggests">
          {exam.proposals.map((s) => (
            <Suggestion
              key={s.id}
              text={s.text}
              onAccept={() => onAccept?.(s.id)}
              onEdit={onEdit ? () => onEdit(s.id) : undefined}
              onDismiss={() => onDismiss?.(s.id)}
            />
          ))}
        </Section>
      ) : null}
    </>
  );
}
