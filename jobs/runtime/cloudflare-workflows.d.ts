// The slice of the `cloudflare:workflows` module the runtime uses (from @cloudflare/workers-types, checked 2026-11-07).
declare module "cloudflare:workflows" {
  /** A fatal error: the Workflow step fails at once and is not retried. */
  export class NonRetryableError extends Error {
    constructor(message: string, name?: string);
  }
}
