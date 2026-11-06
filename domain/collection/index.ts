// domain/collection: collections (nested one level) and their membership rules.
export { parseCollection, parseMembership } from './parse.ts';
export { nestingProblems, canNest, effectiveCollection, moveWrite } from './rules.ts';
