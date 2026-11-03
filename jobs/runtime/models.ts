// The only place model ids and prices live (CONTRACT §model.registry). No environment variable overrides it.
// Prices are US cents per million tokens, from platform.claude.com/docs (models overview and pricing).
export const MODELS_CHECKED_ON = '2026-11-03';
const MAX_AGE_DAYS = 90;

export type ModelPrice = {
  inputCents: number;
  outputCents: number;
  cacheReadCents: number;
  cacheWriteCents: number;
};
export type ModelInfo = {
  id: string;
  maxOutputTokens: number;
  price: ModelPrice;
  /** Haiku 5.5 charges more once a prompt passes 100,000 tokens. */
  longPrompt?: { overTokens: number; price: ModelPrice };
};

export const MODELS = {
  haiku: {
    id: 'claude-haiku-5-5',
    maxOutputTokens: 128_000,
    price: {
      inputCents: 10,
      outputCents: 50,
      cacheReadCents: 1,
      cacheWriteCents: 12.5,
    },
    longPrompt: {
      overTokens: 100_000,
      price: {
        inputCents: 50,
        outputCents: 250,
        cacheReadCents: 5,
        cacheWriteCents: 62.5,
      },
    },
  },
  sonnet: {
    id: 'claude-sonnet-5-5',
    maxOutputTokens: 128_000,
    price: {
      inputCents: 200,
      outputCents: 1000,
      cacheReadCents: 10,
      cacheWriteCents: 250,
    },
  },
} as const satisfies Record<string, ModelInfo>;

export function modelInfo(key: string): ModelInfo {
  const m = (MODELS as Record<string, ModelInfo>)[key];
  if (!m) throw new Error(`Unknown model "${key}"; add it to jobs/runtime/models.ts.`);
  return m;
}

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

/** Cost of one call in cents (fractional). */
export function costCents(key: string, u: Usage): number {
  const m = modelInfo(key);
  const total = u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0);
  const p = m.longPrompt && total > m.longPrompt.overTokens ? m.longPrompt.price : m.price;
  return (
    (u.inputTokens * p.inputCents +
      u.outputTokens * p.outputCents +
      (u.cacheReadTokens ?? 0) * p.cacheReadCents +
      (u.cacheWriteTokens ?? 0) * p.cacheWriteCents) /
    1_000_000
  );
}

/** A warning in plain words when the table is old; null when fresh. */
export function modelsStaleWarning(now: Date): string | null {
  const days = Math.floor((now.getTime() - Date.parse(MODELS_CHECKED_ON)) / 86_400_000);
  return days > MAX_AGE_DAYS
    ? `Model ids and prices were last checked on ${MODELS_CHECKED_ON}, ${days} days ago. Check them against the Anthropic docs.`
    : null;
}
