// Suggestions (CONTRACT §cmd.propose, §data.drafts): an E.V. call in propose mode is saved as a pending `drafts` row;
// Matt accepts it (it then runs as his own direct call and the row is marked kept), edits its input, or dismisses it.
import { byName } from "../commands/index.ts";
import type { suggest } from "../commands/index.ts";
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
  await x.db
    .prepare(
      "INSERT INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v) VALUES (?, ?, ?, 'commands', ?, ?, 'pending', ?, 1)",
    )
    .bind(id, PROPOSER, KIND, s.command, JSON.stringify(s.input), x.clock())
    .run();
  return { ...s, id };
}

async function pending(x: HandlerCtx, id: string): Promise<Row> {
  const r = await x.db
    .prepare(
      "SELECT id, target_id, body, v FROM drafts WHERE id = ? AND kind = ? AND state = 'pending'",
    )
    .bind(id, KIND)
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
  const done = await x.db
    .prepare(
      "UPDATE drafts SET state = ?, body = ?, at = ?, v = v + 1 WHERE id = ? AND v = ? AND state = 'pending'",
    )
    .bind(state, body, x.clock(), r.id, r.v)
    .run();
  if (!done.meta.changes)
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
      await x.db
        .prepare("UPDATE drafts SET state = 'pending', v = v + 1 WHERE id = ?")
        .bind(r.id)
        .run();
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
    const done = await x.db
      .prepare(
        "UPDATE drafts SET body = ?, at = ?, v = v + 1 WHERE id = ? AND v = ? AND state = 'pending'",
      )
      .bind(JSON.stringify(next.data), x.clock(), r.id, r.v)
      .run();
    if (!done.meta.changes)
      throw new CommandError(409, "that Suggestion already changed");
    return { id: r.id, command: r.target_id, input: next.data };
  },

  "proposal.dismiss": async (i: { id: string }, _c, x) => {
    await settle(x, await pending(x, i.id), "dropped");
    return { id: i.id, dismissed: true };
  },
});
