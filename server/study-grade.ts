// Grading a typed open answer on the Worker (CONTRACT §model.ceilings, §model.output): reserve the worst case first (the
// repair ask makes it two calls), grade, then settle the reservation at what was billed. Same path as the ask chat.
import {
  GRADE_MAX_TOKENS,
  GRADE_MODEL,
  GRADE_SYSTEM,
  d1CeilingStore,
  d1JobStore,
  gradeAnswer,
  gradePrompt,
  jobCeilings,
  modelInfo,
  sdkModelCall,
  spendAlertWriter,
} from "../jobs/index.ts";
import type { D1Like, GradeInput, GradeResult, ModelCall } from "../jobs/index.ts";
import { loadCeilingConfig } from "./job-run.ts";

const CHARS_PER_TOKEN = 3;

export interface GradeEnv {
  DB: D1Like;
  ANTHROPIC_API_KEY?: string;
  /** Tests hand in a fake model call; production builds one from the key. */
  ASK_CALL?: ModelCall;
}

export type GradeOutcome =
  | { ok: true; grade: GradeResult; costCents: number }
  | { ok: false; status: 429 | 502 | 503; reason: string };

export async function gradeFromEnv(env: GradeEnv, input: GradeInput, now: () => Date = () => new Date()): Promise<GradeOutcome> {
  const call = env.ASK_CALL ?? (env.ANTHROPIC_API_KEY ? sdkModelCall({ apiKey: env.ANTHROPIC_API_KEY }) : undefined);
  if (!call) return { ok: false, status: 503, reason: "ANTHROPIC_API_KEY is not set on this Worker." };
  const m = modelInfo(GRADE_MODEL);
  const tokensIn = Math.ceil((gradePrompt(input).length + GRADE_SYSTEM.length) / CHARS_PER_TOKEN);
  const maxCents = (2 * (tokensIn * m.price.inputCents + GRADE_MAX_TOKENS * m.price.outputCents)) / 1_000_000;
  const jobId = `grade:${crypto.randomUUID()}`;
  const ceilings = jobCeilings(
    d1CeilingStore(env.DB),
    () => loadCeilingConfig(env.DB),
    now,
    () => crypto.randomUUID(),
    spendAlertWriter(d1JobStore(env.DB, () => now().getTime())),
  );
  try {
    await ceilings.reserve(jobId, maxCents);
  } catch (e) {
    return { ok: false, status: 429, reason: (e as Error).message };
  }
  let spent = 0;
  try {
    const r = await gradeAnswer(call, input);
    spent = r.costCents;
    return r.ok ? { ok: true, grade: r.grade, costCents: r.costCents } : { ok: false, status: 502, reason: r.reason };
  } finally {
    await ceilings.record(`${jobId}:call`, jobId, spent).catch(() => {});
  }
}
