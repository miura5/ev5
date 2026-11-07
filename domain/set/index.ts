import type { SetAnswers, SetItem, StudySet } from "./types.ts";
export {
  /** @public */
  SET_KINDS,
  /** @public */
  SET_WRITERS,
  /** @public */
  type GridRow,
  /** @public */
  type KeyPoint,
  type SetItem,
  type StudySet,
  type SetAnswers,
} from "./types.ts";
export { parseSet } from "./parse.ts";

/** A set's id on the sets table: ids made before the table carry no `set_` prefix and gain it (idempotent). */
export function setKey(id: string): string {
  return id.startsWith("set_") ? id : `set_${id}`;
}

/** An item's id on the set_items table: the same rule with `item_`. */
export function itemKey(id: string): string {
  return id.startsWith("item_") ? id : `item_${id}`;
}
