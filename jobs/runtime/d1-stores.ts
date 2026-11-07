// Thin adapters from the job runtime's store interfaces onto data/'s repositories (§data.gate): jobs/ holds no SQL.
// The repositories own the statements, the Worker clock for `at`, the version pin and the atomic batches.
import { tablesRepo, type DocsD1 } from "../../data/index.ts";
import {
  centralDate,
  planTableId,
  planTableWrite,
} from "../../domain/index.ts";
import type { CeilingStore } from "./ceilings.ts";
import type { JobStore } from "./record.ts";
import type { Plan, PlanContext, PlanStore } from "../prep-plan/job.ts";
import type { DraftRow, PracticeItem } from "../practice-set/job.ts";

/** The slice of D1 the stores use; the data folder defines it. */
export type D1Like = DocsD1;
type D1Statement = ReturnType<D1Like["prepare"]>;

type Clock = () => number;

export function d1JobStore(
  db: D1Like,
  clock: Clock,
  onBad?: NonNullable<Parameters<typeof tablesRepo>[1]["onBad"]>,
): JobStore {
  return tablesRepo(db, { clock, onBad }).jobRecords;
}

export function d1CeilingStore(db: D1Like): CeilingStore {
  // The ceiling statements take no `at`; the clock is not read.
  const { used, findOpen, usageSeen, reserve, settle, release } = tablesRepo(
    db,
    { clock: Date.now },
  ).ceilings;
  return { used, findOpen, usageSeen, reserve, settle, release };
}

/**
 * Moves a plan row to a state through the gate (§data.gate), the one path the plan.approve and plan.put_away commands
 * and the job's decision share. Putting a plan in force first puts away the goal's other plan in force (one in force per
 * goal, §data.tables). Returns the row, or undefined when there is none; a stale version throws "changed".
 */
export async function setPlanState(
  db: D1Like,
  clock: Clock,
  id: string,
  state: "in_force" | "put_away",
) {
  const { plans } = tablesRepo(db, { clock });
  const cur = await plans.get(id);
  if (!cur) return undefined;
  if (cur.state === state) return cur;
  if (state === "in_force")
    for (const other of await plans.list({
      where: { goal_id: cur.goal_id, state: "in_force" },
    }))
      if (other.id !== id) await setPlanState(db, clock, other.id, "put_away");
  const { at: _at, v, deleted_at: _d, ...f } = cur;
  const r = await plans.save({ ...f, state }, v);
  if (!r.ok) throw new Error(`plan ${id} changed; try again`);
  return { ...cur, state };
}

/** The prep plan's content in `job_plans`, keyed by job id so a retried step writes the same row. */
export function d1PlanStore(
  db: D1Like,
  clock: Clock,
  home: {
    /** Reads the exam and weak spots (rows, Central date). */
    load: PlanStore["load"];
  },
): PlanStore {
  const { jobPlans, plans, planItems } = tablesRepo(db, { clock });
  const put = async (jobId: string, kind: string, body: unknown) => {
    await jobPlans.put(jobId, kind, body);
    return `${jobId}:${kind}`;
  };
  const get = async <T>(jobId: string, kind: string): Promise<T | undefined> =>
    (await jobPlans.get(jobId, kind)) as T | undefined;
  const need = async <T>(jobId: string, kind: string) => {
    const v = await get<T>(jobId, kind);
    if (v === undefined) throw new Error(`job ${jobId}: no ${kind} saved`);
    return v;
  };
  /**
   * The plan's rows through the gate: the plan for the goal's context, one item per task. A goal's plan already in force
   * is put away first (one in force per goal). A retried step finds its rows and writes nothing again; the opposite
   * decision to the one saved is refused (a plan settled one way is not unsettled).
   */
  const writeTables = async (
    jobId: string,
    plan: Plan,
    state: "in_force" | "put_away",
  ) => {
    const { goal } = await need<PlanContext>(jobId, "context");
    const w = planTableWrite({
      jobId,
      goalId: goal.id,
      goalTitle: goal.title,
      plan,
      state,
      today: centralDate(clock()),
    });
    const saved = await plans.get(w.plan.id, { deleted: true });
    if (saved) {
      if ((saved.state === "put_away") === (state === "put_away")) return;
      throw new Error(
        `This plan was already ${saved.state === "put_away" ? "put away" : "approved"}.`,
      );
    }
    if (state === "in_force")
      for (const old of await plans.list({
        where: { goal_id: goal.id, state: "in_force" },
      }))
        await setPlanState(db, clock, old.id, "put_away");
    const made = await plans.save(w.plan, null);
    if (!made.ok) throw new Error(`plan ${w.plan.id} was not saved`);
    for (const item of w.items) {
      if (await planItems.get(item.id, { deleted: true })) continue;
      const r = await planItems.save(item, null);
      if (!r.ok) throw new Error(`plan item ${item.id} was not saved`);
    }
  };
  return {
    load: home.load,
    putContext: (j, ctx: PlanContext) => put(j, "context", ctx),
    getContext: (j) => need<PlanContext>(j, "context"),
    putDraft: (j, plan) => put(j, "draft", plan),
    getDraft: (j) => need<Plan>(j, "draft"),
    findDraft: (j) => get<Plan>(j, "draft"),
    async approve(jobId, plan) {
      await writeTables(jobId, plan, "in_force");
      await put(jobId, "status", "approved");
      return planTableId(jobId);
    },
    async putAway(jobId) {
      await writeTables(jobId, await need<Plan>(jobId, "draft"), "put_away");
      return put(jobId, "status", "put away"); // the draft row stays
    },
  };
}

/**
 * The save step: sourced items become set items and unsourced (or "Write with E.V.") items become pending drafts,
 * in ONE batch, so nothing half-lands. A retried step is safe (the repository ignores a repeat).
 */
export async function saveOutput(
  db: D1Like,
  clock: Clock,
  a: {
    jobId: string;
    targetId: string;
    items: PracticeItem[];
    drafts: DraftRow[];
  },
): Promise<{ itemIds: string[]; draftIds: string[] }> {
  return tablesRepo(db, { clock }).jobOutput.save(a);
}
