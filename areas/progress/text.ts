/** "5h 10m in 3 sessions": the minutes of ended study sessions, in the words the mock-up uses. */
export function endedMinutesText(minutes: number, sessions: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `${time} in ${sessions} ${sessions === 1 ? "session" : "sessions"}`;
}
