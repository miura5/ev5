// The one write gate for the side tables (§data.gate), the sibling of data/docs/gate.ts: a row is parsed by its domain rule
// and measured against the size budget before anything is written, and a refusal carries a plain reason. A stale version
// is the only conflict (the Saved result); a refused row throws WriteRefused, so no caller can mistake it for a 409.
import type { Json } from "../compat/canonical.ts";
import { sizeRefusal } from "../docs/budget.ts";

/** A write the rules refused: `message` is the plain reason, and nothing was written. */
export class WriteRefused extends Error {
  readonly table: string;
  constructor(table: string, reason: string) {
    super(`${table}: ${reason}`);
    this.name = "WriteRefused";
    this.table = table;
  }
}

/** Runs the row's domain parse; a throw becomes a WriteRefused naming the table. */
export function gateRow<T>(table: string, build: () => T): T {
  let row: T;
  try {
    row = build();
  } catch (e) {
    throw new WriteRefused(
      table,
      `the row does not parse: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const big = sizeRefusal(row as Json);
  if (big) throw new WriteRefused(table, big);
  return row;
}
