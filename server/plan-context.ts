import type { D1Like } from "../jobs/index.ts";
import { readJobPlans } from "./job-plans.ts";

/** The date each live prep plan was made for, from the context saved at its gather step. */
export async function examsOfPlans(
  db: D1Like,
  ids: string[],
): Promise<Map<string, string>> {
  const exam = new Map<string, string>();
  for (const [jobId, body] of await readJobPlans(db, "context", ids)) {
    const id = (body as { goal?: { id?: unknown } } | null)?.goal?.id;
    if (typeof id === "string") exam.set(jobId, id);
  }
  return exam;
}

/** The proposed sessions of each waiting prep plan, from the draft saved at its draft step. */
export async function draftTasksOfPlans(
  db: D1Like,
  ids: string[],
): Promise<Map<string, { date: string; title: string; minutes: number }[]>> {
  const out = new Map<
    string,
    { date: string; title: string; minutes: number }[]
  >();
  for (const [jobId, body] of await readJobPlans(db, "draft", ids)) {
    const tasks = (body as { tasks?: unknown } | null)?.tasks;
    if (!Array.isArray(tasks)) continue;
    out.set(
      jobId,
      tasks.flatMap(
        (t: { date?: unknown; title?: unknown; minutes?: unknown }) =>
          typeof t?.date === "string" &&
          typeof t.title === "string" &&
          typeof t.minutes === "number"
            ? [{ date: t.date, title: t.title, minutes: t.minutes }]
            : [],
      ),
    );
  }
  return out;
}
