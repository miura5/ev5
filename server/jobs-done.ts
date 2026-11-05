// What finished today (Central), for Activity's "Done today": finished jobs and ended study sessions, in the shape of a
// GET /jobs entry. A separate read (?finished=today) so every other caller of GET /jobs still gets unfinished jobs only.
import { centralDate } from "../domain/index.ts";
import { d1JobStore, isTerminal } from "../jobs/index.ts";
import type { D1Like, JobDef } from "../jobs/index.ts";

type JobStore = ReturnType<typeof d1JobStore>;

export interface DoneEntry {
  id: string;
  kind: string;
  state: "done" | "failed";
  summary: string;
  lead: string;
  reason?: string;
  costCents: number;
  link: { home: string; id: string };
  finished: true;
}

/** Finished jobs whose last change was today (Central), newest first, worded as job_status words them. */
export async function finishedJobsToday(
  store: JobStore,
  defs: ReadonlyMap<string, JobDef>,
  now: number,
): Promise<DoneEntry[]> {
  const today = centralDate(now);
  const out: (DoneEntry & { at: string })[] = [];
  for (const r of await store.list()) {
    if (!isTerminal(r.state) || centralDate(Date.parse(r.updatedAt)) !== today)
      continue;
    const w = defs.get(r.kind)?.wording;
    const failed = r.state === "failed";
    const lead = failed
      ? (w?.failed ?? `${r.title} did not finish.`)
      : (w?.done ?? `${r.title} is done.`);
    out.push({
      id: r.id,
      kind: r.kind,
      state: failed ? "failed" : "done",
      lead,
      summary: failed && r.reason ? `${lead} ${r.reason}` : lead,
      ...(failed && r.reason ? { reason: r.reason } : {}),
      costCents: r.costCents,
      link: !failed && r.output ? r.output : { home: "activity", id: r.id },
      finished: true,
      at: r.updatedAt,
    });
  }
  return out
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ at: _, ...e }) => e);
}

/** Study sessions that ended today (Central): a session is a `sessions` document with `endedAt`. */
export async function endedSessionsToday(
  db: D1Like,
  now: number,
): Promise<DoneEntry[]> {
  const today = centralDate(now);
  // Central today lies within three UTC dates; the exact day is checked below.
  const days = [-1, 0, 1].map((d) =>
    new Date(now + d * 86_400_000).toISOString().slice(0, 10),
  );
  const { results } = await db
    .prepare(
      `SELECT id, data FROM docs WHERE c = 'sessions' AND (${days.map(() => `data LIKE ?`).join(" OR ")})`,
    )
    .bind(...days.map((d) => `%"endedAt":"${d}%`))
    .all<{ id: string; data: string }>();
  const out: DoneEntry[] = [];
  for (const row of results) {
    let d: { status?: string; endedAt?: string; minutes?: number };
    try {
      d = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (d.status !== "ended" || !d.endedAt) continue;
    if (centralDate(Date.parse(d.endedAt)) !== today) continue;
    const m = Math.round(d.minutes ?? 0);
    const lead =
      m > 0
        ? `Studied ${m} ${m === 1 ? "minute" : "minutes"}.`
        : "Study session ended.";
    out.push({
      id: row.id,
      kind: "study-session",
      state: "done",
      summary: lead,
      lead,
      costCents: 0,
      link: { home: "activity", id: row.id },
      finished: true,
    });
  }
  return out;
}
