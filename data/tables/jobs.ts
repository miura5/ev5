// Repositories for the job side tables: a job's saved plan, scope, result or failure (`job_plans`, keyed by job id and kind)
// and the spend ceilings (`claude_settings`, keyed by name). Neither table carries a version: the latest write wins and its
// `at` comes from the Worker clock.
import { parseClaudeSetting, parseJobPlanRow } from "../../domain/index.ts";
import type { D1Like } from "../docs/d1.ts";
import type { TablesOptions } from "./core.ts";
import { gateRow } from "./gate.ts";

export function jobsRepo(db: D1Like, opts: TablesOptions) {
  return {
    jobPlans: {
      /** Saves `body` as the job's `kind` entry, replacing an earlier one. */
      put: async (
        jobId: string,
        kind: string,
        body: unknown,
      ): Promise<void> => {
        const row = gateRow("job_plans", () =>
          parseJobPlanRow({ jobId, kind, body, at: opts.clock() }),
        );
        await db
          .prepare(
            "INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, ?, ?, ?) " +
              "ON CONFLICT (job_id, kind) DO UPDATE SET body = excluded.body, at = excluded.at",
          )
          .bind(row.jobId, row.kind, JSON.stringify(row.body), row.at)
          .run();
      },
    },
    settings: {
      /** Saves each named number, replacing earlier ones. */
      putNumbers: async (values: Record<string, number>): Promise<void> => {
        const at = opts.clock();
        for (const [key, value] of Object.entries(values)) {
          const row = gateRow("claude_settings", () =>
            parseClaudeSetting({ key, value, at }),
          );
          await db
            .prepare(
              "INSERT INTO claude_settings (key, value, at) VALUES (?, ?, ?) " +
                "ON CONFLICT (key) DO UPDATE SET value = excluded.value, at = excluded.at",
            )
            .bind(row.key, row.value, row.at)
            .run();
        }
      },
    },
  };
}
