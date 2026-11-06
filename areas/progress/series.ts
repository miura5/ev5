import {
  addDays,
  centralDate,
  weekday,
  weekdayShort,
} from "../../domain/index.ts";

interface WireDoc {
  id: string;
  data: unknown;
}

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
  answers: readonly WireDoc[],
): { at: number; correct: boolean }[] {
  const out: { at: number; correct: boolean }[] = [];
  for (const d of answers) {
    const doc = d.data as { setId?: unknown; answers?: unknown } | null;
    if (
      !doc ||
      typeof doc.setId !== "string" ||
      !doc.answers ||
      typeof doc.answers !== "object"
    )
      continue;
    for (const keyed of Object.values(doc.answers)) {
      if (!keyed || typeof keyed !== "object") continue;
      let first: { at: number; correct: unknown } | undefined;
      for (const a of Object.values(keyed as Record<string, unknown>)) {
        const r = a as { at?: unknown; correct?: unknown } | null;
        const at = typeof r?.at === "string" ? Date.parse(r.at) : NaN;
        if (Number.isNaN(at)) continue;
        if (!first || at < first.at) first = { at, correct: r?.correct };
      }
      if (first && typeof first.correct === "boolean")
        out.push({ at: first.at, correct: first.correct });
    }
  }
  return out;
}

/** First-try accuracy for each of the last `weeks` Sunday-start Central weeks (oldest first, the last is this week so far); a week with no answers reads 0. Each bar is labelled with its week's first day. */
export function weeklyAccuracy(
  answers: readonly WireDoc[],
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

/** Ended sessions with minutes and an end time, as Central day and minutes. */
function endedByDay(
  sessions: readonly WireDoc[],
): { day: string; minutes: number }[] {
  const out: { day: string; minutes: number }[] = [];
  for (const d of sessions) {
    const s = d.data as {
      status?: unknown;
      minutes?: unknown;
      endedAt?: unknown;
    } | null;
    if (
      s?.status !== "ended" ||
      typeof s.minutes !== "number" ||
      !(s.minutes > 0)
    )
      continue;
    const at = typeof s.endedAt === "string" ? Date.parse(s.endedAt) : NaN;
    if (!Number.isNaN(at))
      out.push({ day: centralDate(at), minutes: s.minutes });
  }
  return out;
}

/** Minutes and number of ended sessions in the last `days` Central days, today included. */
export function windowTotals(
  sessions: readonly WireDoc[],
  now: number,
  days = 7,
): { minutes: number; sessions: number } {
  const from = addDays(centralDate(now), -(days - 1));
  const inWindow = endedByDay(sessions).filter(
    (s) => s.day >= from && s.day <= centralDate(now),
  );
  return {
    minutes: Math.round(inWindow.reduce((a, s) => a + s.minutes, 0)),
    sessions: inWindow.length,
  };
}

/** Minutes of ended sessions per Central day for the last `days` days (oldest first, the last one labelled "Today"). */
export function dailyMinutes(
  sessions: readonly WireDoc[],
  now: number,
  days = 7,
): Point[] {
  const today = centralDate(now);
  const per = new Map<string, number>();
  for (const e of endedByDay(sessions))
    per.set(e.day, (per.get(e.day) ?? 0) + e.minutes);
  const out: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const value = Math.round(per.get(date) ?? 0);
    const label = i === 0 ? "Today" : weekdayShort(date);
    out.push({ label, value, title: `${label} · ${value} m` });
  }
  return out;
}
