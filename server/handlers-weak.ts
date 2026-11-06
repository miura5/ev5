// Weak spots (CONTRACT §ev.capture, §ui.weak-spots, §data.append-only): a weak spot is a `weak_spots` row and everything Matt does
// to it is one appended `weak_spot_events` row (accept, decline, solid), so two quick taps are two inserts and never a 409;
// "mark as learned" is a status, never a delete. A spot E.V. proposed counts nowhere until Matt confirms it. "Just tell me"
// in Ask is logged as Matt's line in today's talk document.
import { tablesRepo } from "../data/index.ts";
import type { WeakSpotEventRow } from "../domain/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { talkLine } from "./handlers-edit.ts";

const tables = (x: HandlerCtx) => tablesRepo(x.db, { clock: x.clock });

const need = async (x: HandlerCtx, id: string) => {
  const spot = await tables(x).weakSpots.get(id);
  if (!spot) throw new CommandError(404, `no weak spot ${id}`);
  return spot;
};

const proposed = async (x: HandlerCtx, id: string) => {
  if ((await need(x, id)).proposed !== 1)
    throw new CommandError(409, `${id} is not a proposed weak spot`);
};

/** Appends one event row for Matt; the gate stamps `at`, and a repeat id (it cannot happen with a fresh one) is a 409. */
async function event(
  x: HandlerCtx,
  id: string,
  type: WeakSpotEventRow["type"],
) {
  const r = await tables(x).weakSpotEvents.add({
    id: `wse_${x.newId().replace(/-/g, "")}`,
    weak_spot_id: id,
    type,
    by: "user",
    note: null,
    objective_id: null,
    until: null,
  });
  if (!r.ok) throw new CommandError(409, "that changed; try again");
}

export const weakHandlers: Record<string, CommandHandler> = {
  // Starting the drill is the screen's; the server agrees once the spot exists.
  "weakspot.drill": async (i: { id: string }, _c, x) => {
    await need(x, i.id);
    return { client: true, id: i.id };
  },
  "weakspot.mark_learned": async (i: { id: string }, _c, x) => {
    await need(x, i.id);
    await event(x, i.id, "solid");
    return { id: i.id, learned: true };
  },
  "weakspot.confirm": async (i: { id: string }, _c, x) => {
    await proposed(x, i.id);
    await event(x, i.id, "accept");
    return { id: i.id, confirmed: true };
  },
  "weakspot.decline": async (i: { id: string }, _c, x) => {
    await proposed(x, i.id);
    await event(x, i.id, "decline");
    return { id: i.id, declined: true };
  },
  // The reply Matt asked to be told is logged; the answer itself is on the Ask screen.
  "ask.just_tell_me": async (i: { id: string }, _c, x) => {
    await talkLine(x, { text: "Just tell me", replyTo: i.id }, "v5/ask");
    return { id: i.id, told: true };
  },
};
