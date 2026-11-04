import { pinSchema, type Pin } from './types.ts';

/** Validates a pins row; unknown fields are refused. */
export function parsePin(raw: unknown): Pin {
  return pinSchema.parse(raw);
}
