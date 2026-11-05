import { Button, Detail } from "../../kit/index.ts";
import type { UpcomingDate } from "./types.ts";

export interface ExamDetailProps {
  exam: UpcomingDate;
  onReviewPlan?: () => void;
  onClose: () => void;
}

/** Detail for a Coming up exam: its date, course and readiness, and its study plan line, and the way to review it. */
export function ExamDetail({ exam, onReviewPlan, onClose }: ExamDetailProps) {
  const { ready, shaky, weak } = exam.readiness;
  const total = ready + shaky + weak;
  return (
    <div className="ev-today-detail">
      <Detail
        title={exam.title}
        onClose={onClose}
        // The same words as Library's exam Detail (areas cannot share code, so the wording is restated).
        properties={[
          { label: "Date", value: exam.dateLine ?? exam.whenFull ?? exam.when },
          { label: "Course", value: exam.course ?? "" },
          {
            label: "Readiness",
            value: total ? `${Math.round((ready / total) * 100)}%` : "none yet",
          },
          {
            label: "Plan",
            value:
              exam.plan === "waiting"
                ? "draft waiting for you"
                : exam.plan === "working"
                  ? "E.V. is saving the plan"
                  : exam.plan === "approved"
                    ? "in force"
                    : "no plan yet",
          },
        ]}
      >
        {onReviewPlan ? (
          <Button onClick={onReviewPlan}>Review the study plan</Button>
        ) : null}
      </Detail>
    </div>
  );
}
