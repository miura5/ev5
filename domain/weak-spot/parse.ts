import { EVENT_TYPES, WEAK_SPOT_KINDS, type WeakSpot } from './types.ts';

const WRITERS = ['page', 'morning', 'worker', 'filing'];
const EVENT_KEY = /^[a-z][a-z-]*-\d{8}-\d{6}(\d{3})?(-[a-z0-9]+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown) => typeof v === 'string' && DATE.test(v);

function parseInitial(init: unknown): void {
  if (!isObj(init)) throw new Error('weak spot: initial is required');
  for (const k of Object.keys(init))
    if (!['streak', 'nextDue', 'recurrence', 'misses'].includes(k))
      throw new Error(`weak spot: unexpected initial.${k}`);
  for (const k of ['streak', 'recurrence', 'misses'])
    if (init[k] !== undefined && !(Number.isInteger(init[k]) && (init[k] as number) >= 0))
      throw new Error(`weak spot: bad initial.${k}`);
  if (init.nextDue != null && !isDate(init.nextDue)) throw new Error('weak spot: bad initial.nextDue');
}

function parseEvents(events: unknown, schema: unknown): void {
  if (!isObj(events)) throw new Error('weak spot: events is required');
  for (const [k, e] of Object.entries(events)) {
    if (!EVENT_KEY.test(k)) throw new Error(`weak spot: bad event key ${k}`);
    if (!isObj(e) || !(EVENT_TYPES as readonly unknown[]).includes(e.type))
      throw new Error(`weak spot: bad event ${k}`);
    if (e.type === 'snooze' && !isDate(e.until)) throw new Error('weak spot: snooze needs until');
    if (schema === 1 && ['accept', 'snooze', 'decline'].includes(e.type as string))
      throw new Error('weak spot: event needs schema 2');
  }
}

/** Validates a weak spot document against the frozen ev4 schema; throws otherwise. Stored derived state is refused. */
export function parseWeakSpot(o: unknown): WeakSpot {
  if (!isObj(o)) throw new Error('weak spot: not an object');
  if ('derived' in o || 'concept' in o) throw new Error('weak spot: derived state is never stored');
  if (o.schema !== 1 && o.schema !== 2) throw new Error('weak spot: schema must be 1 or 2');
  if (!WRITERS.includes(o.writer as string)) throw new Error('weak spot: bad writer');
  if (!str(o.at) || !str(o.source) || !str(o.topic)) throw new Error('weak spot: at, source and topic are required');
  if (typeof o.objective !== 'string') throw new Error('weak spot: objective is required');
  if (!(WEAK_SPOT_KINDS as readonly unknown[]).includes(o.kind)) throw new Error('weak spot: bad kind');
  parseInitial(o.initial);
  parseEvents(o.events, o.schema);
  if (o.schema === 1 && ('proposed' in o || 'words' in o || 'links' in o))
    throw new Error('weak spot: field needs schema 2');
  if (o.proposed !== undefined && typeof o.proposed !== 'boolean') throw new Error('weak spot: bad proposed');
  if (o.readingDue != null && !isDate(o.readingDue)) throw new Error('weak spot: bad readingDue');
  return o as unknown as WeakSpot;
}
