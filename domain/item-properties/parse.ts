import type { Repeat } from '../time/index.ts';
import type { ItemProps } from './types.ts';

const KEYS = ['c', 'id', 'time', 'repeat', 'linkedC', 'linkedId', 'overrides', 'at', 'v'];
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a repeat rule as stored in item_props.repeat. */
export function parseRepeat(raw: unknown): Repeat {
  if (!isObj(raw)) throw new Error('repeat: not an object');
  switch (raw.kind) {
    case 'daily':
    case 'weekdays':
      return { kind: raw.kind };
    case 'weekly': {
      const d = raw.days;
      if (!Array.isArray(d) || d.length === 0 || !d.every((x) => Number.isInteger(x) && x >= 0 && x <= 6))
        throw new Error('repeat: weekly needs days 0-6');
      return { kind: 'weekly', days: [...new Set(d as number[])].sort() };
    }
    case 'every':
      if (!Number.isInteger(raw.n) || (raw.n as number) < 1) throw new Error('repeat: every needs n >= 1');
      if (!str(raw.start) || !DATE.test(raw.start)) throw new Error('repeat: every needs a start date');
      return { kind: 'every', n: raw.n as number, start: raw.start };
    default:
      throw new Error('repeat: unknown kind');
  }
}

/** Validates an item_props row; the linked item is both fields or neither. */
export function parseItemProps(raw: unknown): ItemProps {
  if (!isObj(raw)) throw new Error('item props: not an object');
  for (const k of Object.keys(raw)) if (!KEYS.includes(k)) throw new Error(`item props: unexpected field ${k}`);
  if (!str(raw.c) || !str(raw.id) || !str(raw.at)) throw new Error('item props: c, id and at are required');
  if (!Number.isInteger(raw.v) || (raw.v as number) < 1) throw new Error('item props: bad v');
  const time = raw.time ?? null;
  if (time !== null && !(typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
    throw new Error('item props: time must be HH:MM');
  const linkedC = raw.linkedC ?? null;
  const linkedId = raw.linkedId ?? null;
  if ((linkedC === null) !== (linkedId === null) || (linkedC !== null && !(str(linkedC) && str(linkedId))))
    throw new Error('item props: linkedC and linkedId go together');
  const overrides = raw.overrides ?? null;
  if (overrides !== null) {
    if (!isObj(overrides)) throw new Error('item props: bad overrides');
    for (const x of Object.values(overrides))
      if (x !== null && !['string', 'number', 'boolean'].includes(typeof x))
        throw new Error('item props: bad override');
  }
  return {
    c: raw.c,
    id: raw.id,
    time,
    repeat: raw.repeat == null ? null : parseRepeat(raw.repeat),
    linkedC,
    linkedId,
    overrides,
    at: raw.at,
    v: raw.v as number,
  } as ItemProps;
}
