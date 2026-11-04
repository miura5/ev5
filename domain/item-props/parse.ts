import { itemPropsSchema, type ItemProps } from './types.ts';

/** Validates an item_props row; every field is present, null meaning "not set". */
export function parseItemProps(raw: unknown): ItemProps {
  return itemPropsSchema.parse(raw);
}
