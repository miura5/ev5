// domain/plan: the prep plan job's date rules. The tables are `plans` and `plan_items` (migration 0007): their rows are
// ./table.ts, which also builds them from a job's plan (`planTableWrite`); the data gate writes them (§data.gate) and a plan
// item is unique by repeat and day (§data.repeat). The code validates and the model only arranges (§model.output). Pure: no SQL here.

/** The last day a plan has a task on, or undefined when it has none. Days are Central dates (YYYY-MM-DD), which sort as text. */
export const lastDay = (days: readonly string[]): string | undefined =>
  days.reduce<string | undefined>(
    (m, d) => (m === undefined || d > m ? d : m),
    undefined,
  );

/** True when every day of the plan is before `today` (Central): nothing in it can still be done. A plan with no days is not ended. */
export const planEnded = (days: readonly string[], today: string): boolean => {
  const last = lastDay(days);
  return last !== undefined && last < today;
};

/** What Matt is told when he approves a plan that has already ended (an offer to plan again follows it). */
export const endedReason = (last: string): string =>
  `This plan's days have all passed (its last day was ${last}), so it cannot be approved. Plan again to get a plan from today.`;
