// The slice of the `cloudflare:workers` module the Worker uses (API: WorkflowEntrypoint.run(event, step), checked against
// the Cloudflare Workflows docs 2026-11-03). Replace with @cloudflare/workers-types if that dependency is ever approved.
declare module "cloudflare:workers" {
  export abstract class WorkflowEntrypoint<E = unknown, P = unknown> {
    protected ctx: unknown;
    protected env: E;
    constructor(ctx: unknown, env: E);
    abstract run(
      event: Readonly<{
        payload: Readonly<P>;
        timestamp: Date;
        instanceId: string;
      }>,
      step: unknown,
    ): Promise<unknown>;
  }
}
