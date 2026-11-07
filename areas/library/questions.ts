import { itemType } from "../../domain/index.ts";
import type { SetItemRow } from "../../domain/index.ts";

/** The part of an item body Library shows (the rest of the body is the item's other fields). */
interface QuestionBody {
  stem?: unknown;
  options?: unknown;
  correct?: unknown;
  type?: string;
}

/** A set item row as a question on the set page; a body without a stem is left out, never an error on Library. */
export function questionOf(row: SetItemRow) {
  const b = (row.body ?? {}) as QuestionBody;
  if (typeof b.stem !== "string") return [];
  const options = Array.isArray(b.options) ? (b.options as string[]) : [];
  const correct = Array.isArray(b.correct) ? (b.correct as number[]) : [];
  const type = itemType({ type: row.type, correct });
  return [{ id: row.id, stem: b.stem, options, correct, type }];
}
