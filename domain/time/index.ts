// All time in America/Chicago, using Intl only (no date library). Dates are 'YYYY-MM-DD' strings, times 'HH:MM'.
export const ZONE = 'America/Chicago';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export type Parts = { date: string; time: string };

/** Central wall date and time of an instant. */
export function centralParts(instant: Date | number): Parts {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(instant)) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const centralDate = (instant: Date | number): string => centralParts(instant).date;

function utcMs(date: string, time = '00:00'): number {
  return Date.parse(`${date}T${time}:00Z`);
}

export function addDays(date: string, n: number): string {
  return new Date(utcMs(date) + n * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (date: string): number => new Date(utcMs(date)).getUTCDay();

export const daysBetween = (from: string, to: string): number => Math.round((utcMs(to) - utcMs(from)) / 86_400_000);

/**
 * The instant at which Central wall clock reads `date` `time`. A time skipped by the spring change
 * (02:30 on 2027-03-14) resolves to the same offset as just before the gap, i.e. it lands an hour later on the wall;
 * a time repeated by the fall change (01:30 on 2026-11-01) resolves to its first occurrence.
 */
export function centralToInstant(date: string, time: string): Date {
  const guess = utcMs(date, time);
  for (const offsetH of [5, 6]) {
    // CDT is UTC-5, CST is UTC-6; earliest instant first so a repeated hour yields its first occurrence.
    const t = guess + offsetH * 3_600_000;
    const p = centralParts(t);
    if (p.date === date && p.time === time) return new Date(t);
  }
  return new Date(guess + 6 * 3_600_000); // skipped by the spring change: lands an hour later on the wall
}

/** Scheduled commands: due once the Central wall time has passed and no run exists for that Central date. */
export function isDue(now: Date | number, time: string, runDates: readonly string[]): boolean {
  const { date, time: nowTime } = centralParts(now);
  return nowTime >= time && !runDates.includes(date);
}

/** A one-time deadline due on a Central date is late only after that date has ended. */
export const isOverdue = (now: Date | number, dueDate: string): boolean => centralDate(now) > dueDate;

/** Whole Central days from today until the due date (0 = today, negative = late). */
export const daysUntil = (now: Date | number, dueDate: string): number => daysBetween(centralDate(now), dueDate);

export type Repeat =
  | { kind: 'daily' }
  | { kind: 'weekdays' }
  | { kind: 'weekly'; days: number[] }
  | { kind: 'every'; n: number; start: string };

export function occursOn(rule: Repeat, date: string): boolean {
  switch (rule.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return weekday(date) >= 1 && weekday(date) <= 5;
    case 'weekly':
      return rule.days.includes(weekday(date));
    case 'every': {
      const d = daysBetween(rule.start, date);
      return rule.n >= 1 && d >= 0 && d % rule.n === 0;
    }
  }
}

/** Occurrence dates from `from` through `to`, inclusive. */
export function occurrences(rule: Repeat, from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (occursOn(rule, d)) out.push(d);
  return out;
}

/** The idempotent key a repeat's occurrence is stored under in dayedits.added. */
export const repeatKey = (id: string, date: string): string => `rep-${id}-${date}`;
