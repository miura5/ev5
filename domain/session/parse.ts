import { EVENT_TYPES, STATUSES, type Session } from './types.ts';

const WRITERS = ['page', 'filing'];
const EVENT_KEY = /^[a-z][a-z-]*-\d{8}-\d{6}(\d{3})?(-[a-z0-9]+)?$/;
const NOTE = /^notes\/n-[A-Za-z0-9-]{1,120}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseEvents(events: unknown): void {
  if (events === undefined) return;
  if (!isObj(events)) throw new Error('session: bad events');
  for (const [k, e] of Object.entries(events)) {
    if (!EVENT_KEY.test(k)) throw new Error(`session: bad event key ${k}`);
    if (!isObj(e) || !(EVENT_TYPES as readonly unknown[]).includes(e.type)) throw new Error(`session: bad event ${k}`);
    if (e.len !== undefined && !(Number.isInteger(e.len) && (e.len as number) >= 0))
      throw new Error(`session: bad len on ${k}`);
    if (e.result !== undefined && e.result !== 'pass' && e.result !== 'miss')
      throw new Error(`session: bad result on ${k}`);
  }
}

function validPlanned(v: unknown): boolean {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 600;
}

/** Validates a session document against the frozen ev4 schema; throws otherwise. The note's text is never accepted. */
export function parseSession(o: unknown): Session {
  if (!isObj(o)) throw new Error('session: not an object');
  if ('text' in o || 'noteText' in o) throw new Error('session: the note text never enters a session');
  if (o.schema !== 2) throw new Error('session: schema must be 2');
  if (!WRITERS.includes(o.writer as string)) throw new Error('session: bad writer');
  if (!str(o.at)) throw new Error('session: at is required');
  if (o.source !== 'Study Watch' && o.source !== 'E.V. Home') throw new Error('session: bad source');
  if (typeof o.date !== 'string' || !DATE.test(o.date)) throw new Error('session: bad date');
  if (o.status !== undefined && !(STATUSES as readonly unknown[]).includes(o.status))
    throw new Error('session: bad status');
  if (o.kind !== undefined && o.kind !== 'note' && o.kind !== 'skill') throw new Error('session: bad kind');
  if (o.note !== undefined && !(typeof o.note === 'string' && NOTE.test(o.note))) throw new Error('session: bad note');
  if (o.planned !== undefined && !validPlanned(o.planned)) throw new Error('session: bad planned');
  if (o.clock !== undefined && o.clock !== 'writing') throw new Error('session: bad clock');
  if (o.comments !== undefined && !['more', 'some', 'off'].includes(o.comments as string))
    throw new Error('session: bad comments');
  parseEvents(o.events);
  return o as unknown as Session;
}
