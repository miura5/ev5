// domain/item-properties: an item's time, repeat, linked item and overrides; a repeat materializes idempotently.
export type { PlanTemplate } from './types.ts';
export { parseItemProps, parseRepeat } from './parse.ts';
export { materialize, unresolvedLinks, overridden } from './rules.ts';
