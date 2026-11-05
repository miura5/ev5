import { useState } from "react";
import { plainDay, weekdayShort } from "../../domain/index.ts";
import {
  Button,
  Empty,
  Row,
  Section,
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
  /** "Plan with E.V.": asks E.V. to draft a study plan for this exam. */
  onPlanWithEv?: () => void;
  /** The draft plan's three answers: approve it, ask for changes (with his note), or put it away. */
  onApprove?: (planId: string) => void;
  onAskChanges?: (planId: string, note: string) => void;
  onPutAway?: (planId: string) => void;
  /** Opens with the proposal showing (the exam was opened by a link to review its plan). */
  startOpen?: boolean;
}

/** The shell Detail for an exam date: its properties, then the study plan's actions and E.V.'s session proposals. */
export function examPlanDetail(p: ExamPlanDetailProps): DetailProps {
  const { exam } = p;
  return {
    title: exam.title,
    onClose: p.onClose,
    properties: [
      { label: "Date", value: exam.when },
      { label: "Course", value: exam.course },
      { label: "Readiness", value: exam.readiness },
      { label: "Plan", value: exam.plan },
    ],
    // Keyed on the plan's state, so a new state starts the body fresh.
    children: <ExamPlanBody key={`${exam.id}:${exam.planState}`} {...p} />,
  };
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
  startOpen,
}: ExamPlanDetailProps) {
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [review, setReview] = useState(
    !!startOpen || exam.planState === "approved",
  );
  const draft = exam.planState === "draft" && exam.planId;
  const planId = exam.planId ?? "";
  const approved = exam.planState === "approved";
  const count = exam.sessions?.length ?? 0;
  return (
    <>
      <Button
        onClick={() => {
          setReview((r) => !r);
          onReviewPlan?.();
        }}
      >
        Review the study plan
      </Button>
      {exam.planState === "working" ? (
        <div data-part="working">
          <Empty line="E.V. is saving the plan…" />
        </div>
      ) : null}
      {approved ? (
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
          <Section label={approved ? "Sessions in your plan" : "Proposed sessions"}>
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
            <Empty line="Built from: this exam's date and your weak spots for it" />
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
      {!draft && exam.proposals.length === 0 ? (
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
