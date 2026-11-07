// What finished today (Central), for Activity's "Done today": finished jobs and ended sessions, in the shape of a
// GET /jobs entry. A separate read (?finished=today) so every other caller of GET /jobs still gets unfinished jobs only.
import { tablesRepo } from "../data/index.ts";
import { centralDate, goalFromRow, sessionDocId } from "../domain/index.ts";
import { d1JobStore, isTerminal } from "../jobs/index.ts";
import type { D1Like, JobDef } from "../jobs/index.ts";
import { examsOfPlans } from "./plan-context.ts";

/** The job store as this file reads it: the options are honoured by the D1 store and ignored by a plain one. */
type JobStore = {
  list(o?: {
    since?: number;
  }): Promise<Awaited<ReturnType<ReturnType<typeof d1JobStore>["list"]>>>;
};
/** A Central day is at most 25 hours; two days back covers every record last written today. */
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

export interface DoneEntry {
  id: string;
  kind: string;
  state: "done" | "failed";
  summary: string;
  lead: string;
  reason?: string;
  costCents: number;
  link: { home: string; id: string };
  /** A prep plan's date title, so Activity can word it "Prep plan · <date>". */
  goalTitle?: string;
  finished: true;
}

/** The date title of each finished prep plan, by job id; a plan whose date or title is gone has none. */
async function goalTitles(
  db: D1Like,
  planIds: string[],
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const examOf = await examsOfPlans(db, planIds);
  const byExam = new Map<string, string | undefined>();
  for (const [job, goalId] of examOf) {
    if (!byExam.has(goalId)) {
      const row = await tablesRepo(db as never, { clock: () => Date.now() })
        .goals.get(goalId)
        .catch(() => null);
      byExam.set(goalId, (row && goalFromRow(row))?.title);
    }
    const t = byExam.get(goalId);
    if (t) titles.set(job, t);
  }
  return titles;
}

/** Finished jobs whose last change was today (Central), newest first, worded as job_status words them. */
export async function finishedJobsToday(
  store: JobStore,
  db: D1Like,
  defs: ReadonlyMap<string, JobDef>,
  now: number,
): Promise<DoneEntry[]> {
  const today = centralDate(now);
  const out: (DoneEntry & { at: string })[] = [];
  const todays = (await store.list({ since: now - TWO_DAYS })).filter(
    (r) =>
      isTerminal(r.state) && centralDate(Date.parse(r.updatedAt)) === today,
  );
  const titles = await goalTitles(
    db,
    todays.filter((r) => r.kind === "prep_plan").map((r) => r.id),
  );
  for (const r of todays) {
    const w = defs.get(r.kind)?.wording;
    const failed = r.state === "failed";
    // A prep plan put away ends done with its status row as the output (jobs/runtime/d1-stores.ts), not a plan.
    const putAway = r.kind === "prep_plan" && r.output?.id.endsWith(":status");
    const lead = failed
      ? (w?.failed ?? `${r.title} did not finish.`)
      : putAway
        ? "Your prep plan was put away."
        : (w?.done ?? `${r.title} is done.`);
    out.push({
      id: r.id,
      kind: r.kind,
      state: failed ? "failed" : "done",
      lead,
      summary: failed && r.reason ? `${lead} ${r.reason}` : lead,
      ...(failed && r.reason ? { reason: r.reason } : {}),
      costCents: r.costCents,
      link:
        !failed && !putAway && r.output
          ? r.output
          : { home: "activity", id: r.id },
      ...(titles.has(r.id) ? { goalTitle: titles.get(r.id) } : {}),
      finished: true,
      at: r.updatedAt,
    });
  }
  return out
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ at: _, ...e }) => e);
}

/** Sessions that ended today (Central): a `sessions` row with its `ended_at`. */
export async function endedSessionsToday(
  db: D1Like,
  now: number,
  onBad?: Parameters<typeof tablesRepo>[1]["onBad"],
): Promise<DoneEntry[]> {
  const today = centralDate(now);
  const ended = await tablesRepo(db, { clock: () => now, onBad }).sessions.list(
    {
      where: { status: "ended" },
      min: { ended_at: now - TWO_DAYS },
    },
  );
  const out: DoneEntry[] = [];
  for (const row of ended) {
    if (row.ended_at === null || centralDate(row.ended_at) !== today) continue;

    const id = sessionDocId(row.id);
    const m = Math.round(row.minutes ?? 0);
    const lead =
      m > 0
        ? `Studied ${m} ${m === 1 ? "minute" : "minutes"}.`
        : "Session ended.";
    out.push({
      id,
      kind: "study-session",
      state: "done",
      summary: lead,
      lead,
      costCents: 0,
      link: { home: "activity", id },
      finished: true,
    });
  }
  return out;
}
