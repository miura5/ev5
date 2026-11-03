import { Button, Detail, Suggestion } from "../../kit/index.ts";
import type { ExamPlanData } from "./types.ts";
import "./library.css";

export interface ExamPlanDetailProps {
  exam: ExamPlanData;
  onReviewPlan?: () => void;
  onAccept?: (proposalId: string) => void;
  onEdit?: (proposalId: string) => void;
  onDismiss?: (proposalId: string) => void;
  onClose?: () => void;
}

/** Detail for an exam date: its properties, E.V.'s dashed session proposals, and the plan's main action. */
export function ExamPlanDetail({
  exam,
  onReviewPlan,
  onAccept,
  onEdit,
  onDismiss,
  onClose,
}: ExamPlanDetailProps) {
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
      {exam.proposals.length === 0 ? (
        <Button kind="text">Plan with E.V.</Button>
      ) : (
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
      )}
    </Detail>
  );
}
