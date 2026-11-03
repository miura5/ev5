import type { Pin } from './types.ts';

const KEYS = ['targetC', 'targetId', 'pos', 'at'];
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Validates a pins row; unknown fields are refused. */
export function parsePin(raw: unknown): Pin {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('pin: not an object');
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) throw new Error(`pin: unexpected field ${k}`);
  if (!str(o.targetC) || !str(o.targetId) || !str(o.at)) throw new Error('pin: targetC, targetId and at are required');
  if (typeof o.pos !== 'number' || !Number.isFinite(o.pos)) throw new Error('pin: bad pos');
  return o as Pin;
}
