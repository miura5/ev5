import { Detail } from "../../kit/index.ts";
import type { UpcomingDate } from "./types.ts";

export interface ExamDetailProps {
  exam: UpcomingDate;
  planWaiting: boolean;
  onReviewPlan?: () => void;
  onClose: () => void;
}

/** Detail for a Coming up exam: its date, course and readiness, and its study plan when one waits. */
export function ExamDetail({
  exam,
  planWaiting,
  onReviewPlan,
  onClose,
}: ExamDetailProps) {
  const { ready, shaky, weak } = exam.readiness;
  return (
    <div className="ev-today-detail">
      <Detail
        title={exam.title}
        onClose={onClose}
        primary={
          planWaiting && onReviewPlan
            ? { label: "Review the study plan", hint: "S", onRun: onReviewPlan }
            : undefined
        }
        properties={[
          { label: "Date", value: exam.whenFull ?? exam.when },
          ...(exam.course ? [{ label: "Course", value: exam.course }] : []),
          {
            label: "Readiness",
            value: `${ready} ready · ${shaky} shaky · ${weak} weak`,
          },
          {
            label: "Plan",
            value: planWaiting ? "waiting for you" : "none yet",
          },
        ]}
      />
    </div>
  );
}
