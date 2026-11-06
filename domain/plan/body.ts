// The prep plan's body: what the prep plan job's model writes and what the app sends. Ranges and formats are
// refinements, so the JSON Schema sent to the model stays within what structured output supports (§model.output);
// the job's checkPlan holds the semantic rules. One shape here, so commands/ and jobs/ keep none of their own.
import { z } from "zod";

const text = (what: string, max = 200) =>
  z
    .string({ error: `${what}: needs 1 to ${max} characters` })
    .refine(
      (t) => t.trim().length > 0 && t.length <= max,
      `${what}: needs 1 to ${max} characters`,
    );

export const planTaskSchema = z.object({
  date: z.string().refine((d) => /^\d{4}-\d{2}-\d{2}$/.test(d), "bad date"),
  title: text("title"),
  minutes: z
    .number()
    .int()
    .refine(
      (m) => m >= 10 && m <= 120,
      "minutes must be a whole number from 10 to 120",
    ),
  weakSpotId: text("weakSpotId", 128).optional(),
});

export const planBodySchema = z.object(
  {
    summary: text("summary", 400),
    tasks: z.array(planTaskSchema, { error: "tasks must be a list" }),
  },
  { error: "plan: not an object" },
);
