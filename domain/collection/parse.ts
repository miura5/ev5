import { collectionSchema, membershipSchema, type Collection, type Membership } from './types.ts';

/** Validates a collections row. */
export function parseCollection(raw: unknown): Collection {
  return collectionSchema.parse(raw);
}

/** Validates a memberships row. */
export function parseMembership(raw: unknown): Membership {
  return membershipSchema.parse(raw);
}
