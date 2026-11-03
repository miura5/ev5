// studyplan.ask_changes: Matt's note about a draft plan goes to Haiku, which proposes small patches (remove, add,
// update). Code applies them to a copy of the draft and re-validates the result with the same checks as the first
// draft (§cmd.code-first). The model call is injected; a bad patch gets one repair ask via runStructured.
import { runStructured, type ModelCall } from "../runtime/output.ts";
import {
  checkPlan,
  parsePlan,
  type Plan,
  type PlanContext,
  type Task,
} from "./job.ts";

export const CHANGES_MODEL = "haiku";
export const CHANGES_MAX_TOKENS = 6000;
const MAX_OPS = 40;

export type Op =
  | { op: "remove"; task: number }
  | {
      op: "add";
      date: string;
      title: string;
      minutes: number;
      weakSpotId?: string;
    }
  | {
      op: "update";
      task: number;
      date?: string;
      title?: string;
      minutes?: number;
      weakSpotId?: string;
    };
export type Patch = { summary?: string; ops: Op[] };

export const PATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ops"],
  properties: {
    summary: { type: "string" },
    ops: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op"],
        properties: {
          op: { type: "string", enum: ["remove", "add", "update"] },
          task: { type: "integer" },
          date: { type: "string" },
          title: { type: "string" },
          minutes: { type: "integer" },
          weakSpotId: { type: "string" },
        },
      },
    },
  },
};

export function parsePatch(raw: unknown): Patch {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("patch: not an object");
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.ops)) throw new Error("patch: ops must be a list");
  if (o.ops.length > MAX_OPS)
    throw new Error(`patch: more than ${MAX_OPS} changes`);
  const ops = o.ops.map((x, i): Op => {
    if (typeof x !== "object" || x === null)
      throw new Error(`change ${i + 1}: not an object`);
    const r = x as Record<string, unknown>;
    const { op, task, ...rest } = r;
    if (op === "add") {
      if (task != null)
        throw new Error(`change ${i + 1}: add takes no task number`);
      return { op, ...rest } as Op;
    }
    if (op !== "remove" && op !== "update")
      throw new Error(`change ${i + 1}: op must be remove, add or update`);
    if (!Number.isInteger(task) || (task as number) < 1)
      throw new Error(`change ${i + 1}: task must be a number from 1`);
    return op === "remove"
      ? { op, task: task as number }
      : ({ op, task, ...rest } as Op);
  });
  const summary = o.summary == null ? undefined : o.summary;
  if (summary !== undefined && typeof summary !== "string")
    throw new Error("patch: summary must be text");
  return summary === undefined ? { ops } : { summary, ops };
}

/** Applies a patch to a copy of the draft. Task numbers are 1-based positions in the draft as given. */
export function applyPatch(draft: Plan, patch: Patch): Plan {
  const tasks: (Task | null)[] = draft.tasks.map((t) => ({ ...t }));
  const added: unknown[] = [];
  patch.ops.forEach((o, i) => {
    if (o.op === "add") {
      const { op: _op, ...t } = o;
      added.push(t);
      return;
    }
    const cur = tasks[o.task - 1];
    if (!cur)
      throw new Error(
        `change ${i + 1}: there is no task ${o.task} (or it was already removed)`,
      );
    if (o.op === "remove") tasks[o.task - 1] = null;
    else {
      const { op: _op, task: _t, ...fields } = o;
      tasks[o.task - 1] = { ...cur, ...fields };
    }
  });
  return parsePlan({
    summary: patch.summary ?? draft.summary,
    tasks: [...tasks.filter((t) => t !== null), ...added],
  });
}

export type AskChangesDeps = { call: ModelCall; system: string };

/** Returns the changed plan, or the reason in plain words. The caller stores it; the draft is never edited in place. */
export async function askChanges(
  { call, system }: AskChangesDeps,
  input: { draft: Plan; ctx: PlanContext; note: string },
): Promise<
  | { ok: true; plan: Plan; costCents: number }
  | { ok: false; reason: string; costCents: number }
> {
  const { draft, ctx, note } = input;
  const r = await runStructured<Plan>({
    call,
    model: CHANGES_MODEL,
    system,
    prompt: JSON.stringify({
      context: ctx,
      plan: draft.tasks.map((t, i) => ({ task: i + 1, ...t })),
      summary: draft.summary,
      note,
    }),
    maxTokens: CHANGES_MAX_TOKENS,
    schema: PATCH_SCHEMA,
    // The patch is applied inside parse so a patch that does not apply gets the repair ask too.
    parse: (raw) => applyPatch(draft, parsePatch(raw)),
    check: (p) => checkPlan(p, ctx),
  });
  return r.ok ? { ok: true, plan: r.value, costCents: r.costCents } : r;
}
