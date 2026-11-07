// The slice of Cloudflare's D1 API the repositories use; the real binding satisfies it structurally.
export interface D1Statement {
  bind(...values: (string | number | null)[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface D1Like {
  prepare(sql: string): D1Statement;
  /** All statements in one transaction: if one throws, none of them applies. */
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
