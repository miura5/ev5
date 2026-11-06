/** "up from 69%" next to 72% reads "up 3 points, on the 2 weeks before"; anything else is left as written. */
export function trendText(percent: string, trend: string): string {
  const m = /^(up|down) from (\d+)%$/.exec(trend);
  const now = parseInt(percent, 10);
  if (!m || Number.isNaN(now)) return trend;
  const n = Math.abs(now - Number(m[2]));
  return `${m[1]} ${n} ${n === 1 ? "point" : "points"} on the 2 weeks before`;
}
