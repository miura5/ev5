import type { AnswerLike } from "./attempts.ts";
import { addDays, centralDate, weekday } from "../../domain/index.ts";

export interface Point {
  label: string;
  value: number;
  title: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Nov 1" for a date, or just "20" when it stays in the month of the label before it. */
function dayLabel(
  date: string,
  prevMonth: string | null,
): { label: string; month: string } {
  const month = date.slice(5, 7);
  const day = String(Number(date.slice(8, 10)));
  const name = MONTHS[Number(month) - 1] ?? "";
  return { label: month === prevMonth ? day : `${name} ${day}`, month };
}

/** Each item's first answer (the first-try rule), skipping "just tell me" taps and anything malformed. */
function firstTries(
  answers: readonly AnswerLike[],
): { at: number; correct: boolean }[] {
  // One attempts row is one answer, so an item's first try is found across rows.
  const firsts = new Map<string, { at: number; correct: unknown }>();
  for (const d of answers) {
    const doc = d.data as { setId?: unknown; answers?: unknown } | null;
    if (
      !doc ||
      typeof doc.setId !== "string" ||
      !doc.answers ||
      typeof doc.answers !== "object"
    )
      continue;
    for (const [item, keyed] of Object.entries(doc.answers)) {
      if (!keyed || typeof keyed !== "object") continue;
      const key = `${doc.setId}/${item}`;
      for (const a of Object.values(keyed as Record<string, unknown>)) {
        const r = a as { at?: unknown; correct?: unknown } | null;
        const at = typeof r?.at === "string" ? Date.parse(r.at) : NaN;
        if (Number.isNaN(at)) continue;
        const first = firsts.get(key);
        if (!first || at < first.at)
          firsts.set(key, { at, correct: r?.correct });
      }
    }
  }
  const out: { at: number; correct: boolean }[] = [];
  for (const f of firsts.values())
    if (typeof f.correct === "boolean")
      out.push({ at: f.at, correct: f.correct });
  return out;
}

/** First-try accuracy for each of the last `weeks` Sunday-start Central weeks (oldest first, the last is this week so far); a week with no answers reads 0. Each bar is labelled with its week's first day. */
export function weeklyAccuracy(
  answers: readonly AnswerLike[],
  now: number,
  weeks = 8,
): Point[] {
  const tries = firstTries(answers).map((t) => ({
    date: centralDate(t.at),
    correct: t.correct,
  }));
  const today = centralDate(now);
  const thisWeek = addDays(today, -weekday(today));
  const out: Point[] = [];
  let prevMonth: string | null = null;
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w);
    const end = addDays(start, 6);
    const inWeek = tries.filter((t) => t.date >= start && t.date <= end);
    const value = inWeek.length
      ? Math.round(
          (100 * inWeek.filter((t) => t.correct).length) / inWeek.length,
        )
      : 0;
    const { label, month } = dayLabel(start, prevMonth);
    prevMonth = month;
    out.push({
      label,
      value,
      title: inWeek.length
        ? `Week of ${label} · ${value}%`
        : `Week of ${label} · no answers`,
    });
  }
  return out;
}
