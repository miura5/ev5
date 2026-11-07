// The one writer of `attempts` rows (§data.append-only, §data.gate, §data.item-versions): every practice answer, whatever
// screen it came from, is recorded here as one row through the gate. The row names the item and the version it answered, read
// from the item's own row, so an answer cannot be filed against an item that does not exist, is deleted, or sits in another set.
import type { AttemptRow } from "../../domain/index.ts";
import type { D1Like } from "../d1.ts";
import type { TablesOptions } from "./core.ts";
import { WriteRefused } from "./gate.ts";
import { kindsRepo, type Fields } from "./kinds.ts";

/** What a caller says about an answer; the item's version and the row's `at` and `v` are not theirs to say. */
export type AttemptInput = Omit<Fields<AttemptRow>, "item_v">;

export function attemptsRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  return {
    attempts: {
      ...k.attempts,
      /** Appends one attempts row. A repeated id (an outbox retry) is a conflict, so the row is never doubled. */
      record: async (a: AttemptInput) => {
        const item = await k.setItems.get(a.item_id);
        if (!item || item.set_id !== a.set_id)
          throw new WriteRefused(
            "attempts",
            `${a.item_id} is not an item of ${a.set_id}`,
          );
        return k.attempts.add({ ...a, item_v: item.v });
      },
      /**
       * Appends one attempts row for a turn that is not a set item (a note check-in line, an Ask E.V. "just tell me"). It names
       * the turn in `item_id` and its home in `set_id`, with `item_v` 1, and is never graded, so no reader counts it toward
       * accuracy. Still one row through the gate; a repeated id is a conflict (§data.append-only, §data.gate).
       */
      recordLogOnly: (a: Omit<AttemptInput, "score"> & { score?: null }) =>
        k.attempts.add({ ...a, score: null, item_v: 1 }),
    },
  };
}
