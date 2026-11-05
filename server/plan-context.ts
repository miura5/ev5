import type { D1Like } from "../jobs/index.ts";

/** The exam each live study plan was made for, from the context saved at its gather step. */
export async function examsOfPlans(
  db: D1Like,
  ids: string[],
): Promise<Map<string, string>> {
  const exam = new Map<string, string>();
  if (!ids.length) return exam;
  const { results } = await db
    .prepare(
      `SELECT job_id, body FROM job_plans WHERE kind = 'context' AND job_id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<{ job_id: string; body: string }>();
  for (const r of results)
    try {
      const id = (JSON.parse(r.body) as { exam?: { id?: unknown } }).exam?.id;
      if (typeof id === "string") exam.set(r.job_id, id);
    } catch {
      // a context that does not read is left without an exam
    }
  return exam;
}

/** The proposed sessions of each waiting study plan, from the draft saved at its draft step. */
export async function draftTasksOfPlans(
  db: D1Like,
  ids: string[],
): Promise<Map<string, { date: string; title: string; minutes: number }[]>> {
  const out = new Map<
    string,
    { date: string; title: string; minutes: number }[]
  >();
  if (!ids.length) return out;
  const { results } = await db
    .prepare(
      `SELECT job_id, body FROM job_plans WHERE kind = 'draft' AND job_id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<{ job_id: string; body: string }>();
  for (const r of results)
    try {
      const tasks = (JSON.parse(r.body) as { tasks?: unknown }).tasks;
      if (!Array.isArray(tasks)) continue;
      out.set(
        r.job_id,
        tasks.flatMap(
          (t: { date?: unknown; title?: unknown; minutes?: unknown }) =>
            typeof t?.date === "string" &&
            typeof t.title === "string" &&
            typeof t.minutes === "number"
              ? [{ date: t.date, title: t.title, minutes: t.minutes }]
              : [],
        ),
      );
    } catch {
      // a draft that does not read is left without sessions
    }
  return out;
}
