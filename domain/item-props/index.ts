// domain/item-props: per-item properties (time, repeat, linked item, overrides) and a repeat's occurrences in a day's `added` map.
export { parseItemProps } from './parse.ts';
export { materialize, missingOccurrences } from './rules.ts';
