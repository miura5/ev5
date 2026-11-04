// studyplan.ask_changes: Matt's note about a draft plan goes to Haiku, which proposes small patches (remove, add,
// update). Code applies them to a copy of the draft and re-validates the result with the same checks as the first
// draft (§cmd.code-first). The model call is injected; a bad patch gets one repair ask via runStructured.
import { z } from "zod";
import { parseWith } from "../runtime/define.ts";
import { outputSchema } from "../runtime/model-call.ts";
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

// One flat op shape, as the model writes it. Which fields each op needs is checked below; the plan the patch makes is
// then parsed in full by parsePlan.
const OpSchema = z
  .object({
    op: z.enum(["remove", "add", "update"], {
      error: "op must be remove, add or update",
    }),
    task: z.number().int().optional(),
    date: z.string().optional(),
    title: z.string().optional(),
    minutes: z.number().int().optional(),
    weakSpotId: z.string().optional(),
  })
  .superRefine((o, ctx) => {
    if (o.op === "add" && o.task != null)
      ctx.addIssue({ code: "custom", message: "add takes no task number" });
    if (o.op !== "add" && (o.task == null || o.task < 1))
      ctx.addIssue({
        code: "custom",
        message: "task must be a number from 1",
      });
  });
export const PatchSchema = z.object(
  {
    summary: z.string().optional(),
    ops: z
      .array(OpSchema, { error: "ops must be a list" })
      .refine((o) => o.length <= MAX_OPS, `more than ${MAX_OPS} changes`),
  },
  { error: "patch: not an object" },
);
export type Op = z.infer<typeof OpSchema>;
export type Patch = z.infer<typeof PatchSchema>;

export const parsePatch = parseWith(PatchSchema);

const present = (o: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Applies a patch to a copy of the draft. Task numbers are 1-based positions in the draft as given. */
export function applyPatch(draft: Plan, patch: Patch): Plan {
  const tasks: (Task | null)[] = draft.tasks.map((t) => ({ ...t }));
  const added: unknown[] = [];
  patch.ops.forEach((o, i) => {
    if (o.op === "add") {
      const { op: _op, task: _t, ...t } = o;
      added.push(present(t));
      return;
    }
    const n = o.task ?? 0;
    const cur = tasks[n - 1];
    if (!cur)
      throw new Error(
        `change ${i + 1}: there is no task ${n} (or it was already removed)`,
      );
    if (o.op === "remove") tasks[n - 1] = null;
    else {
      const { op: _op, task: _t, ...fields } = o;
      tasks[n - 1] = { ...cur, ...present(fields) };
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
    schema: outputSchema(PatchSchema),
    // The patch is applied inside parse so a patch that does not apply gets the repair ask too.
    parse: (raw) => applyPatch(draft, parsePatch(raw)),
    check: (p) => checkPlan(p, ctx),
  });
  return r.ok ? { ok: true, plan: r.value, costCents: r.costCents } : r;
}
