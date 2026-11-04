// E.V.'s set-item drafts (CONTRACT §data.drafts): a draft stays in `drafts` until Matt keeps it. Keeping copies it into its
// set and marks it kept in ONE batch, so the copy exists exactly once; dropping only marks it (§delete.soft: nothing is
// removed). Suggestions (kind 'suggestion') are the proposal.* commands' and are never touched here.
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";

type Row = { id: string; target_id: string; v: number };
const KIND = "set-item";

async function pending(x: HandlerCtx, where: string, arg: string) {
  const { results } = await x.db
    .prepare(
      `SELECT id, target_id, v FROM drafts WHERE ${where} AND kind = ? AND state = 'pending' ORDER BY at, id`,
    )
    .bind(arg, KIND)
    .all<Row>();
  return results;
}

/** Settles each draft; a keep copies it first, guarded on the draft still being pending at the version read. */
async function settle(x: HandlerCtx, rows: Row[], keep: boolean) {
  const at = x.clock();
  await x.db.batch(
    rows.flatMap((r) => [
      ...(keep
        ? [
            x.db
              .prepare(
                "INSERT OR IGNORE INTO own_set_items (set_id, item_id, pos, body, at, v) SELECT target_id, id, " +
                  "(SELECT COALESCE(MAX(pos) + 1, 0) FROM own_set_items WHERE set_id = ?), body, ?, 1 " +
                  "FROM drafts WHERE id = ? AND v = ? AND state = 'pending'",
              )
              .bind(r.target_id, at, r.id, r.v),
          ]
        : []),
      x.db
        .prepare(
          "UPDATE drafts SET state = ?, at = ?, v = v + 1 WHERE id = ? AND v = ? AND state = 'pending'",
        )
        .bind(keep ? "kept" : "dropped", at, r.id, r.v),
    ]),
  );
}

const one =
  (keep: boolean): CommandHandler =>
  async (i: { id: string }, _c, x) => {
    const rows = await pending(x, "id = ?", i.id);
    if (!rows.length) throw new CommandError(404, `no pending draft ${i.id}`);
    await settle(x, rows, keep);
    return { id: i.id, state: keep ? "kept" : "dropped" };
  };

const all =
  (keep: boolean): CommandHandler =>
  async (i: { set: string }, _c, x) => {
    const rows = await pending(x, "target_id = ?", i.set);
    if (rows.length) await settle(x, rows, keep);
    return { set: i.set, [keep ? "kept" : "dropped"]: rows.length };
  };

export const draftHandlers: Record<string, CommandHandler> = {
  "draft.keep": one(true),
  "draft.drop": one(false),
  "draft.keep_all": all(true),
  "draft.drop_all": all(false),
};
