// The kind tables the public repository exposes (§data.gate).
import type { D1Like } from "../d1.ts";
import type { TablesOptions } from "./core.ts";
import { kindsRepo } from "./kinds.ts";

/**
 * The kind tables the public repository exposes. Notes and set items are read here only: their writes go through
 * `noteBook` (size budget, §data.notes) and `setBook` (item versions, §data.item-versions), the one gate path (§data.gate).
 */
export function publicKinds(db: D1Like, opts: TablesOptions) {
  const { notes, setItems, ...rest } = kindsRepo(db, opts);
  return {
    ...rest,
    notes: { get: notes.get, list: notes.list },
    setItems: { get: setItems.get, list: setItems.list },
  };
}
