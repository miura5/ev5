import type { Collection, Membership } from './types.ts';

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function shape(name: string, raw: unknown, keys: string[]): Record<string, unknown> {
  if (!isObj(raw)) throw new Error(`${name}: not an object`);
  for (const k of Object.keys(raw)) if (!keys.includes(k)) throw new Error(`${name}: unexpected field ${k}`);
  return raw;
}

/** Validates a collections row; a real id never starts with "course:" (that prefix is the virtual courses). */
export function parseCollection(raw: unknown): Collection {
  const o = shape('collection', raw, ['id', 'title', 'parentId', 'pos', 'at', 'v']);
  if (!str(o.id) || o.id.startsWith('course:')) throw new Error('collection: bad id');
  if (!str(o.title) || !str(o.at)) throw new Error('collection: title and at are required');
  if (o.parentId !== null && !str(o.parentId)) throw new Error('collection: bad parentId');
  if (o.parentId === o.id) throw new Error('collection: cannot be its own parent');
  if (typeof o.pos !== 'number' || !Number.isFinite(o.pos)) throw new Error('collection: bad pos');
  if (!Number.isInteger(o.v) || (o.v as number) < 1) throw new Error('collection: bad v');
  return o as Collection;
}

/** Validates a memberships row. */
export function parseMembership(raw: unknown): Membership {
  const o = shape('membership', raw, ['itemC', 'itemId', 'collectionId', 'at', 'v']);
  if (!str(o.itemC) || !str(o.itemId) || !str(o.collectionId) || !str(o.at)) throw new Error('membership: bad field');
  if (!Number.isInteger(o.v) || (o.v as number) < 1) throw new Error('membership: bad v');
  return o as Membership;
}
