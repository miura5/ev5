// The Workflow class bound as JOBS in wrangler.jsonc (CONTRACT §job.steps). It only adapts Cloudflare's event and step
// to runWorkflow, which holds the logic and is tested without the Cloudflare runtime.
import { WorkflowEntrypoint } from "cloudflare:workers";
import { sdkModelCall } from "../jobs/index.ts";
import type { InstanceParams, StepConfig, StepRunner } from "../jobs/index.ts";
import practiceSetPrompt from "../jobs/practice-set/prompt.md?raw";
import studyPlanPrompt from "../jobs/study-plan/prompt.md?raw";
import type { Env } from "./index.ts";
import { runWorkflow } from "./job-run.ts";
import { planHome } from "./plan-home.ts";

type CfStep = {
  do<T>(
    name: string,
    config: StepConfig,
    fn: (c: { attempt: number }) => Promise<T>,
  ): Promise<T>;
};

export class JobWorkflow extends WorkflowEntrypoint<Env, InstanceParams> {
  async run(
    event: { payload: Readonly<InstanceParams> },
    step: unknown,
  ): Promise<void> {
    const cf = step as CfStep;
    const runner: StepRunner = {
      do: (name, config, fn) => cf.do(name, config, fn),
    };
    if (!this.env.ANTHROPIC_API_KEY)
      throw new Error("ANTHROPIC_API_KEY is not set on this Worker.");
    await runWorkflow(
      {
        db: this.env.DB,
        call: sdkModelCall({ apiKey: this.env.ANTHROPIC_API_KEY }),
        prompts: {
          practice_set: practiceSetPrompt,
          study_plan: studyPlanPrompt,
        },
        planHome: planHome(this.env.DB, () => Date.now()),
      },
      runner,
      event.payload,
    );
  }
}
