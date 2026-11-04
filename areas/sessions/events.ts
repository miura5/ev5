/** The events a pause, resume and End add to a session document (ev4 sessions schema 2); everything else is kept. */
const pad = (n: number) => String(n).padStart(2, "0");

/** An event key for `now`: page-YYYYMMDD-HHMMSS-xxxx, the form the session clock reads the time from. */
export function eventKey(now: Date, rand: string): string {
  const d = now;
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `page-${stamp}-${rand.toLowerCase().replace(/[^a-z0-9]/g, "") || "x"}`;
}

type Raw = Record<string, unknown>;

/** The envelope every session write carries (§data.protocol): who wrote, when. ev4 freezes the sessions source enum. */
const stamp = (now: Date) => ({ writer: "page", at: now.toISOString(), source: "E.V. Home" });

function withEvent(raw: Raw, type: string, now: Date, rand: string): Raw {
  const events = (raw.events ?? {}) as Raw;
  return {
    ...raw,
    ...stamp(now),
    events: {
      ...events,
      [eventKey(now, rand)]: { type, at: now.toISOString() },
    },
  };
}

/** Pause is a break, and Resume ends it. */
export const withPause = (raw: Raw, paused: boolean, now: Date, rand: string) =>
  withEvent(raw, paused ? "break" : "resume", now, rand);

/** End: status ended, when, an end event, and the minutes studied, which is what Progress counts. */
export function withEnd(
  raw: Raw,
  minutes: number,
  now: Date,
  rand: string,
): Raw {
  const e = withEvent(raw, "end", now, rand);
  const events = e.events as Record<string, Raw>;
  const key = Object.keys(events).find(
    (k) => events[k]?.type === "end" && events[k]?.at === now.toISOString(),
  );
  if (key) events[key] = { ...events[key], why: "ended" };
  return { ...e, status: "ended", endedAt: now.toISOString(), minutes };
}

/** "Just tell me" on a check: one answer event, why "tell-me" (no check number: nothing is marked answered by it). */
export function withTellMe(raw: Raw, now: Date, rand: string): Raw {
  const events = (raw.events ?? {}) as Raw;
  const e = { type: "answer", at: now.toISOString(), why: "tell-me" };
  return { ...raw, ...stamp(now), events: { ...events, [eventKey(now, rand)]: e } };
}
