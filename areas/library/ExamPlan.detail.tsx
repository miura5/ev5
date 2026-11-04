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
}

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
}: ExamPlanDetailProps) {
  const [note, setNote] = useState("");
  const draft = exam.planState === "draft" && exam.planId;
  const planId = exam.planId ?? "";
  return (
    <Detail
      title={exam.title}
      onClose={onClose}
      primary={{
        label: "Review the study plan",
        hint: "S",
        onRun: () => onReviewPlan?.(),
      }}
      properties={[
        { label: "Date", value: exam.when },
        { label: "Course", value: exam.course },
        { label: "Readiness", value: exam.readiness },
        { label: "Plan", value: exam.plan },
      ]}
    >
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
