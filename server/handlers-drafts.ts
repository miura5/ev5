// E.V.'s set-item drafts (CONTRACT §data.drafts): a draft stays in `drafts` until Matt keeps it. Keeping copies it into its
// set and marks it kept in ONE batch, so the copy exists exactly once; dropping only marks it (§delete.soft: nothing is
// removed). Suggestions (kind 'suggestion') are the proposal.* commands' and are never touched here.
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";

const KIND = "set-item";
const drafts = (x: HandlerCtx) => tablesRepo(x.db, { clock: x.clock }).drafts;

const one =
  (keep: boolean): CommandHandler =>
  async (i: { id: string }, _c, x) => {
    const rows = await drafts(x).pendingById(i.id, KIND);
    if (!rows.length) throw new CommandError(404, `no pending draft ${i.id}`);
    await drafts(x).settle(rows, keep);
    return { id: i.id, state: keep ? "kept" : "dropped" };
  };

const all =
  (keep: boolean): CommandHandler =>
  async (i: { set: string }, _c, x) => {
    const rows = await drafts(x).pendingForSet(i.set, KIND);
    if (rows.length) await drafts(x).settle(rows, keep);
    return { set: i.set, [keep ? "kept" : "dropped"]: rows.length };
  };

export const draftHandlers: Record<string, CommandHandler> = {
  "draft.keep": one(true),
  "draft.drop": one(false),
  "draft.keep_all": all(true),
  "draft.drop_all": all(false),
};
