// Suggestions (CONTRACT §cmd.propose, §data.drafts): an E.V. call in propose mode is saved as a pending `drafts` row;
// Matt accepts it (it then runs as his own direct call and the row is marked kept), edits its input, or dismisses it.
import { byName } from "../commands/index.ts";
import type { suggest } from "../commands/index.ts";
import { tablesRepo } from "../data/index.ts";
import { draftKey } from "../domain/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";

type Row = { id: string; target_id: string; body: string; v: number };
type Suggestion = ReturnType<typeof suggest>;
const PROPOSER = "ev";
const KIND = "suggestion";

/** Saves the Suggestion and returns it with its id (the id Matt's accept, edit and dismiss name). */
export async function saveSuggestion(
  x: Pick<HandlerCtx, "db" | "clock" | "newId">,
  s: Suggestion,
): Promise<Suggestion & { id: string }> {
  const id = x.newId();
  await repo(x).create({
    id,
    job_id: PROPOSER,
    kind: KIND,
    target_kind: "commands",
    target_id: s.command,
    body: s.input as Record<string, unknown>,
  });
  return { ...s, id };
}

const repo = (x: Pick<HandlerCtx, "db" | "clock">) =>
  tablesRepo(x.db, { clock: x.clock }).drafts;

async function pending(x: HandlerCtx, id: string): Promise<Row> {
  const r = await x.db
    .prepare(
      "SELECT id, target_id, body, v FROM drafts WHERE id = ? AND kind = ? AND state = 'pending'",
    )
    .bind(draftKey(id), KIND)
    .first<Row>();
  if (!r) throw new CommandError(404, `no pending Suggestion ${id}`);
  return r;
}

/** Moves the row on only if nobody else did first (the version guard), so a double accept runs once. */
async function settle(
  x: HandlerCtx,
  r: Row,
  state: "kept" | "dropped",
  body = r.body,
) {
  if (!(await repo(x).claim(r.id, r.v, state, body)))
    throw new CommandError(409, "that Suggestion already changed");
}

export const proposalHandlers = (
  all: () => Record<string, CommandHandler>,
): Record<string, CommandHandler> => ({
  "proposal.accept": async (i: { id: string }, caller, x) => {
    const r = await pending(x, i.id);
    const run = all()[r.target_id];
    if (!run) throw new CommandError(501, `${r.target_id} has no handler yet`);
    // Claim first so a double accept applies once; a command that fails hands the Suggestion back.
    await settle(x, r, "kept");
    try {
      return {
        applied: r.target_id,
        result: await run(JSON.parse(r.body) as never, caller, x),
      };
    } catch (e) {
      // The claim left the row at r.v + 1; hand it back only if nobody moved it since (the version pin).
      if (!(await repo(x).reopen(r.id, r.v + 1)))
        throw new CommandError(409, "that Suggestion already changed");
      throw e;
    }
  },

  "proposal.edit": async (
    i: { id: string; input: Record<string, unknown> },
    _c,
    x,
  ) => {
    const r = await pending(x, i.id);
    const cmd = byName(r.target_id);
    const next = cmd?.input.safeParse({ ...JSON.parse(r.body), ...i.input });
    if (!next?.success)
      throw new CommandError(400, "that edit does not fit the command");
    if (!(await repo(x).edit(r.id, r.v, JSON.stringify(next.data))))
      throw new CommandError(409, "that Suggestion already changed");
    return { id: i.id, command: r.target_id, input: next.data };
  },

  "proposal.dismiss": async (i: { id: string }, _c, x) => {
    await settle(x, await pending(x, i.id), "dropped");
    return { id: i.id, dismissed: true };
  },
});
