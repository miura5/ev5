// A failure that will repeat (a refusal, max_tokens, output still wrong after the repair ask) must end its step at
// once: Workflows' NonRetryableError does that (§job.steps, one retry layer). Node has no `cloudflare:workflows`, so
// tests and scripts get a same-named class; the test Workflows fake treats either as final.
type Ctor = new (message: string, name?: string) => Error;

class LocalNonRetryableError extends Error {
  constructor(message: string, name = 'NonRetryableError') {
    super(message);
    this.name = name;
  }
}

const platform = await import('cloudflare:workflows').then(
  (m) => m.NonRetryableError as Ctor,
  () => undefined,
);

export const NonRetryableError: Ctor = platform ?? LocalNonRetryableError;

/** True for an error that must not be retried. */
export const isNonRetryable = (e: unknown): boolean =>
  e instanceof NonRetryableError || e instanceof LocalNonRetryableError || (e as Error | undefined)?.name === 'NonRetryableError';
