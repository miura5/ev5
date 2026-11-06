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

/** Ids of the items with at least one attempt. */
export function answeredItems(set: StudySet, answers: SetAnswers): string[] {
  return set.items
    .filter((q) => Object.keys(answers[q.id] ?? {}).length > 0)
    .map((q) => q.id);
}

/** A set is done once every item has an attempt: its first attempt through counts, and a retry never undoes it. */
export function setDone(set: StudySet, answers: SetAnswers): boolean {
  return (
    set.items.length > 0 &&
    answeredItems(set, answers).length === set.items.length
  );
}

/** The header note for a set short of the count it was asked for, else ''. */
export function setShortfall(set: StudySet): string {
  const n = set.items.length;
  const asked = set.asked ?? 0;
  return asked > n
    ? `${n} of ${asked}: ${asked - n} didn’t pass E.V.’s checks`
    : "";
}

/** A set's id on the sets table: ids made before the table carry no `set_` prefix and gain it (idempotent). */
export function setKey(id: string): string {
  return id.startsWith("set_") ? id : `set_${id}`;
}

/** An item's id on the set_items table: the same rule with `item_`. */
export function itemKey(id: string): string {
  return id.startsWith("item_") ? id : `item_${id}`;
}
