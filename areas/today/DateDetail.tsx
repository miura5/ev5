import {
  DATE_KINDS,
  kindOffers,
  plainDay,
  weekdayShort,
} from "../../domain/index.ts";
import {
  Button,
  Row,
  Section,
  Segmented,
  type DetailProps,
} from "../../kit/index.ts";
import type { UpcomingDate } from "./types.ts";

export interface DateDetailHandlers {
  onReviewPlan?: () => void;
  /** "Plan with E.V.": asks E.V. to draft a prep plan for this date (only a kind that offers one shows it). */
  onPlanWithEv?: () => void;
  /** The Kind picker: sets the date's kind (a key of the kind registry). */
  onKind?: (kind: string) => void;
  onClose: () => void;
}

/** The registry's kinds as the picker words them ("exam" reads "Exam"); a kind outside the registry reads as "other". */
const KINDS = Object.keys(DATE_KINDS);
const word = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
const known = (k: string) => (Object.hasOwn(DATE_KINDS, k) ? k : "other");

/** The shell Detail for a Coming up date: its date, readiness and kind, and its prep plan where the kind offers one. */
export function dateDetail(
  exam: UpcomingDate,
  { onReviewPlan, onPlanWithEv, onKind, onClose }: DateDetailHandlers,
): DetailProps {
  const { ready, shaky, weak } = exam.readiness;
  const total = ready + shaky + weak;
  // The registry says which kinds offer a prep plan; a plan already made still shows after a kind change.
  const offers = kindOffers(exam.kind, "prep-plan");
  const plans = offers || !!exam.plan;
  return {
    title: exam.title,
    onClose,
    // The same words as Library's exam Detail (areas cannot share code, so the wording is restated).
    properties: [
      { label: "Date", value: exam.dateLine ?? exam.whenFull ?? exam.when },
      {
        label: "Readiness",
        value: total ? `${Math.round((ready / total) * 100)}%` : "none yet",
      },
      ...(plans
        ? [
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
          ]
        : []),
    ],
    children: (
      <>
        <Section label="Kind">
          <Segmented
            label="Kind"
            options={KINDS.map(word)}
            value={word(known(exam.kind))}
            onChange={(v) => onKind?.(v.toLowerCase())}
          />
        </Section>
        {plans && onReviewPlan ? (
          <Button onClick={onReviewPlan}>Review the prep plan</Button>
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
        {offers && !exam.plan && onPlanWithEv ? (
          <Button kind="text" onClick={onPlanWithEv}>
            Plan with E.V.
          </Button>
        ) : null}
      </>
    ),
  };
}
