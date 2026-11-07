// Repositories for the job side tables: a job's saved plan, scope, result or failure (`job_plans`, keyed by job id and kind)
// and the spend ceilings (`settings`, keyed by name). The latest write wins; its `at` comes from the Worker clock and each write raises `v`.
import {
  parseSettingRow,
  parseJobPlanRow,
  parseStoredPlan,
  parseStoredPlanBody,
} from "../../domain/index.ts";
import type { D1Like } from "../d1.ts";
import { reportBad } from "./core.ts";
import type { TablesOptions } from "./core.ts";
import { gateRow } from "./gate.ts";

export function jobsRepo(db: D1Like, opts: TablesOptions) {
  return {
    jobPlans: {
      /** The saved body for (job, kind), or undefined. */
      get: async (jobId: string, kind: string): Promise<unknown> => {
        const r = await db
          .prepare("SELECT body FROM job_plans WHERE job_id = ? AND kind = ?")
          .bind(jobId, kind)
          .first<unknown>();
        return r ? parseStoredPlanBody(r) : undefined;
      },
      /** The saved bodies of one kind for several jobs, by job id; a row that does not parse is left out. */
      getMany: async (
        kind: string,
        ids: string[],
      ): Promise<Map<string, unknown>> => {
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
      },
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
      /** Every stored setting as key to number; a row that does not parse is reported through `onBad` and left out. */
      readNumbers: async (): Promise<Map<string, number>> => {
        const { results } = await db
          .prepare("SELECT key, value, at, v FROM settings")
          .all<Record<string, unknown>>();
        const out = new Map<string, number>();
        for (const r of results) {
          try {
            const s = parseSettingRow(r);
            out.set(s.key, s.value);
          } catch (e) {
            reportBad(opts, "settings", String(r.key ?? "?"), e);
          }
        }
        return out;
      },
      /** Saves each named number, replacing earlier ones. */
      putNumbers: async (values: Record<string, number>): Promise<void> => {
        const at = opts.clock();
        for (const [key, value] of Object.entries(values)) {
          const row = gateRow("settings", () =>
            parseSettingRow({ key, value, at, v: 1 }),
          );
          await db
            .prepare(
              "INSERT INTO settings (key, value, at, v) VALUES (?, ?, ?, 1) " +
                "ON CONFLICT (key) DO UPDATE SET value = excluded.value, at = excluded.at, v = v + 1",
            )
            .bind(row.key, row.value, row.at)
            .run();
        }
      },
    },
  };
}
