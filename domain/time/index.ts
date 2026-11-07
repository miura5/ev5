// Time in the user's zone, today the one constant ZONE (§job.schedule); Intl only. Dates 'YYYY-MM-DD', times 'HH:MM'.
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

/** Scheduled commands: due once the Central wall time has passed and no run exists for that Central date. */
export function isDue(now: Date | number, time: string, runDates: readonly string[]): boolean {
  const { date, time: nowTime } = centralParts(now);
  return nowTime >= time && !runDates.includes(date);
}

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A day in plain words: 'Dec 1', with the year when it is not `today`'s year ('Dec 1, 2027'). */
export function plainDay(date: string, today: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const label = `${MONTHS[(m ?? 1) - 1]} ${d}`;
  return y === Number(today.slice(0, 4)) ? label : `${label}, ${y}`;
}

/** Time left in plain words: 'today', 'in 1 day', 'in N days'. */
export const inDays = (n: number): string => (n === 0 ? 'today' : `in ${n} ${n === 1 ? 'day' : 'days'}`);

const chicago = (o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-US', { timeZone: ZONE, ...o });
const SHORT_DAY = chicago({ month: 'short', day: 'numeric' });
const LONG_DAY = chicago({ weekday: 'long', month: 'long', day: 'numeric' });
const CLOCK = chicago({ hour: 'numeric', minute: '2-digit' });
// A 'YYYY-MM-DD' date is read as midnight UTC, so it formats in UTC to keep the same calendar day.
const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' });
const WEEKDAY_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' });

/** 'Nov 3', the Central day of an instant. */
export const shortDay = (instant: Date | number): string => SHORT_DAY.format(instant);

/** 'Thursday, November 5', the Central day of an instant. */
export const longDay = (instant: Date | number): string => LONG_DAY.format(instant);

/** '3:05 pm', the Central clock time of an instant. */
export const clockTime = (instant: Date | number): string => CLOCK.format(instant).toLowerCase();

/** 'Tue' for a Central date ('YYYY-MM-DD'). */
export const weekdayShort = (date: string): string => WEEKDAY_SHORT.format(utcMs(date));

/** 'Tuesday, Nov 3' for a Central date ('YYYY-MM-DD'). */
export const weekdayDay = (date: string): string => WEEKDAY_DAY.format(utcMs(date));
