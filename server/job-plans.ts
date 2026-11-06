import { parseStoredPlan, parseStoredPlanBody } from "../domain/index.ts";
import type { D1Like } from "../jobs/index.ts";

/** One saved job_plans body (kind plan, scope, result, draft, context or failure), parsed on read (§data.gate). */
export async function readJobPlan(
  db: D1Like,
  jobId: string,
  kind: string,
): Promise<unknown> {
  const row = await db
    .prepare("SELECT body FROM job_plans WHERE job_id = ? AND kind = ?")
    .bind(jobId, kind)
    .first<unknown>();
  return row ? parseStoredPlanBody(row) : undefined;
}

/** The saved bodies of one kind for several jobs, by job id; a row that does not parse is left out. */
export async function readJobPlans(
  db: D1Like,
  kind: string,
  ids: string[],
): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  if (!ids.length) return out;
  const { results } = await db
    .prepare(
      `SELECT job_id, body FROM job_plans WHERE kind = ? AND job_id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(kind, ...ids)
    .all<unknown>();
  for (const r of results)
    try {
      const { jobId, body } = parseStoredPlan(r);
      out.set(jobId, body);
    } catch {
      // a row that does not read is left out
    }
  return out;
}
