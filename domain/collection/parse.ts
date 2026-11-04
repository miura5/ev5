import { collectionSchema, membershipSchema, type Collection, type Membership } from './types.ts';

/** Validates a collections row; a real id never starts with "course:" (that prefix is the virtual courses). */
export function parseCollection(raw: unknown): Collection {
  return collectionSchema.parse(raw);
}

/** Validates a memberships row. */
export function parseMembership(raw: unknown): Membership {
  return membershipSchema.parse(raw);
}
