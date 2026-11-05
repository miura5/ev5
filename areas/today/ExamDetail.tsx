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
  return (
    <div className="ev-today-detail">
      <Detail
        title={exam.title}
        onClose={onClose}
        properties={[
          { label: "Date", value: exam.whenFull ?? exam.when },
          ...(exam.course ? [{ label: "Course", value: exam.course }] : []),
          {
            label: "Readiness",
            value: `${ready} ready · ${shaky} shaky · ${weak} weak`,
          },
          {
            label: "Plan",
            value:
              exam.plan === "waiting"
                ? "waiting for you"
                : exam.plan === "approved"
                  ? "approved"
                  : "none yet",
          },
        ]}
      >
        {exam.plan && onReviewPlan ? (
          <Button onClick={onReviewPlan}>Review the study plan</Button>
        ) : null}
      </Detail>
    </div>
  );
}
