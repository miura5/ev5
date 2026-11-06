/** "5h 10m" or "45m": a number of minutes in the words the mock-up uses. */
export function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "5h 10m in 3 sessions": the minutes of ended sessions. */
export function endedMinutesText(minutes: number, sessions: number): string {
  return `${minutesText(minutes)} in ${sessions} ${sessions === 1 ? "session" : "sessions"}`;
}

/** "up from 69%" next to 72% reads "up 3 points, on the 2 weeks before"; anything else is left as written. */
export function trendText(percent: string, trend: string): string {
  const m = /^(up|down) from (\d+)%$/.exec(trend);
  const now = parseInt(percent, 10);
  if (!m || Number.isNaN(now)) return trend;
  const n = Math.abs(now - Number(m[2]));
  return `${m[1]} ${n} ${n === 1 ? "point" : "points"} on the 2 weeks before`;
}
