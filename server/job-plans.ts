import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import type { D1Like } from "../jobs/index.ts";

const plans = (db: D1Like) =>
  tablesRepo(db as DocsD1, { clock: () => Date.now() }).jobPlans;

/** One saved job_plans body (kind plan, scope, result, draft, context or failure), parsed on read (§data.gate). */
export const readJobPlan = (
  db: D1Like,
  jobId: string,
  kind: string,
): Promise<unknown> => plans(db).get(jobId, kind);

/** The saved bodies of one kind for several jobs, by job id; a row that does not parse is left out. */
export const readJobPlans = (
  db: D1Like,
  kind: string,
  ids: string[],
): Promise<Map<string, unknown>> => plans(db).getMany(kind, ids);
