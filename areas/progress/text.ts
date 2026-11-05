/** "5 h 10 m" or "45 m": a number of minutes in the words the mock-up uses. */
export function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}

/** "5 h 10 m in 3 sessions": the minutes of ended study sessions. */
export function endedMinutesText(minutes: number, sessions: number): string {
  return `${minutesText(minutes)} in ${sessions} ${sessions === 1 ? "session" : "sessions"}`;
}
