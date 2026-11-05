import { plainDay, weekdayShort } from "../../domain/index.ts";
import { Button, Row, Section, type DetailProps } from "../../kit/index.ts";
import type { UpcomingDate } from "./types.ts";

export interface ExamDetailHandlers {
  onReviewPlan?: () => void;
  /** "Plan with E.V.": asks E.V. to draft a study plan for this exam. */
  onPlanWithEv?: () => void;
  onClose: () => void;
}

/** The shell Detail for a Coming up exam: its date, course and readiness, its study plan line, and the way to review it. */
export function examDetail(
  exam: UpcomingDate,
  { onReviewPlan, onPlanWithEv, onClose }: ExamDetailHandlers,
): DetailProps {
  const { ready, shaky, weak } = exam.readiness;
  const total = ready + shaky + weak;
  return {
    title: exam.title,
    onClose,
    // The same words as Library's exam Detail (areas cannot share code, so the wording is restated).
    properties: [
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
    ],
    children: (
      <>
        {onReviewPlan ? (
          <Button onClick={onReviewPlan}>Review the study plan</Button>
        ) : null}
        {exam.plan === "waiting" || exam.plan === "approved" ? (
          <Section
            label={
              exam.plan === "approved"
                ? "Sessions in your plan"
                : "Proposed sessions"
            }
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
              <span>The sessions are not shown here yet.</span>
            )}
          </Section>
        ) : null}
        {!exam.plan && onPlanWithEv ? (
          <Button kind="text" onClick={onPlanWithEv}>
            Plan with E.V.
          </Button>
        ) : null}
      </>
    ),
  };
}
