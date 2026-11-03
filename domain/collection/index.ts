// domain/collection: collections (nested one level), their membership rules and the virtual ev4 course collections.
export { parseCollection, parseMembership } from './parse.ts';
export {
  courseCollectionId,
  virtualCourse,
  virtualCollections,
  nestingProblems,
  canNest,
  effectiveCollection,
  moveWrite,
} from './rules.ts';
export type { Collection, Membership, VirtualCollection } from './types.ts';
