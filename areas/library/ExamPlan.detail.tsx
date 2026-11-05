import { useState } from "react";
import { Button, Detail, Suggestion, TextArea } from "../../kit/index.ts";
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

/** "Tue" for a Central date. */
const dayOf = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });

/** Detail for an exam date: its properties, the study plan's actions, and E.V.'s dashed session proposals. */
export function ExamPlanDetail({
  exam,
  onReviewPlan,
  onAccept,
  onEdit,
  onDismiss,
  onClose,
  onPlanWithEv,
  onApprove,
  onAskChanges,
  onPutAway,
  startOpen,
}: ExamPlanDetailProps) {
  const [note, setNote] = useState("");
  const [review, setReview] = useState(!!startOpen);
  const draft = exam.planState === "draft" && exam.planId;
  const planId = exam.planId ?? "";
  return (
    <Detail
      title={exam.title}
      onClose={onClose}
      properties={[
        { label: "Date", value: exam.when },
        { label: "Course", value: exam.course },
        { label: "Readiness", value: exam.readiness },
        { label: "Plan", value: exam.plan },
      ]}
    >
      <Button
        onClick={() => {
          setReview((r) => !r);
          onReviewPlan?.();
        }}
      >
        Review the study plan
      </Button>
      {review ? (
        <div className="ev-library-panel" data-part="proposal">
          <h3 className="ev-library-label">Proposed sessions</h3>
          {exam.sessions?.length ? (
            exam.sessions.map((s, i) => (
              <div key={`${s.date}-${i}`} className="ev-library-session">
                <span>{dayOf(s.date)}</span>
                <span>{s.title}</span>
                <span>{s.minutes}m</span>
              </div>
            ))
          ) : (
            <span>The sessions are not shown here yet.</span>
          )}
          <span>
            Built from: this exam&apos;s date and your weak spots for it
          </span>
        </div>
      ) : null}
      {draft ? (
        <div className="ev-library-panel">
          <Button kind="primary" onClick={() => onApprove?.(planId)}>
            Approve
          </Button>
          <TextArea
            label="Ask for changes"
            placeholder="What should change?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            disabled={!note.trim()}
            onClick={() => {
              onAskChanges?.(planId, note.trim());
              setNote("");
            }}
          >
            Send changes
          </Button>
          <Button kind="text" onClick={() => onPutAway?.(planId)}>
            Put away
          </Button>
        </div>
      ) : null}
      {!draft && exam.proposals.length === 0 ? (
        <Button kind="text" onClick={() => onPlanWithEv?.()}>
          Plan with E.V.
        </Button>
      ) : null}
      {exam.proposals.length > 0 ? (
        <div className="ev-library-panel">
          {exam.proposals.map((s) => (
            <Suggestion
              key={s.id}
              text={s.text}
              onAccept={() => onAccept?.(s.id)}
              onEdit={onEdit ? () => onEdit(s.id) : undefined}
              onDismiss={() => onDismiss?.(s.id)}
            />
          ))}
        </div>
      ) : null}
    </Detail>
  );
}
