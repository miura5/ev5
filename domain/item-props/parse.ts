import { addDays, type Repeat } from '../time/index.ts';
import type { ItemProps, Linked, Overrides } from './types.ts';

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v;
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function shape(name: string, raw: unknown, keys: string[]): Record<string, unknown> {
  if (!isObj(raw)) throw new Error(`${name}: not an object`);
  for (const k of Object.keys(raw)) if (!keys.includes(k)) throw new Error(`${name}: unexpected field ${k}`);
  return raw;
}

function parseRepeat(raw: unknown): Repeat {
  if (!isObj(raw)) throw new Error('repeat: not an object');
  switch (raw.kind) {
    case 'daily':
    case 'weekdays':
      shape('repeat', raw, ['kind']);
      return { kind: raw.kind };
    case 'weekly': {
      shape('repeat', raw, ['kind', 'days']);
      const days = raw.days;
      if (!Array.isArray(days) || days.length === 0 || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))
        throw new Error('repeat: weekly needs days 0-6');
      return {
        kind: 'weekly',
        days: [...new Set(days as number[])].sort((a, b) => a - b),
      };
    }
    case 'every': {
      shape('repeat', raw, ['kind', 'n', 'start']);
      if (!Number.isInteger(raw.n) || (raw.n as number) < 1) throw new Error('repeat: every needs n >= 1');
      if (!isDate(raw.start)) throw new Error('repeat: every needs a start date');
      return { kind: 'every', n: raw.n as number, start: raw.start };
    }
    default:
      throw new Error('repeat: unknown kind');
  }
}

function parseLinked(raw: unknown): Linked | null {
  if (raw === null) return null;
  const o = shape('item_props linked', raw, ['c', 'id']);
  if (!str(o.c) || !str(o.id)) throw new Error('item_props: bad linked');
  return { c: o.c, id: o.id };
}

function parseOverrides(raw: unknown): Overrides | null {
  if (raw === null) return null;
  if (!isObj(raw)) throw new Error('item_props: bad overrides');
  for (const v of Object.values(raw))
    if (v !== null && !['string', 'number', 'boolean'].includes(typeof v)) throw new Error('item_props: bad overrides');
  return raw as Overrides;
}

/** Validates an item_props row; every field is present, null meaning "not set". */
export function parseItemProps(raw: unknown): ItemProps {
  const o = shape('item_props', raw, ['c', 'id', 'time', 'repeat', 'linked', 'overrides', 'at', 'v']);
  if (!str(o.c) || !str(o.id) || !str(o.at)) throw new Error('item_props: c, id and at are required');
  if (o.time !== null && !isTime(o.time)) throw new Error('item_props: bad time');
  if (!Number.isInteger(o.v) || (o.v as number) < 1) throw new Error('item_props: bad v');
  const { c, id, time, at, v } = o as {
    c: string;
    id: string;
    time: string | null;
    at: string;
    v: number;
  };
  const repeat = o.repeat === null ? null : parseRepeat(o.repeat);
  return {
    c,
    id,
    time,
    repeat,
    linked: parseLinked(o.linked),
    overrides: parseOverrides(o.overrides),
    at,
    v,
  };
}
