// Weak spots (CONTRACT §ev.capture, §ui.weak-spots, §data.append-only): a weak spot is a `weak_spots` row and everything Matt does
// to it is one appended `weak_spot_events` row (accept, decline, solid), so two quick taps are two inserts and never a 409;
// "mark as learned" is a status, never a delete. A spot E.V. proposed counts nowhere until Matt confirms it. "Just tell me"
// in Ask is logged as the user's line, one talk row.
import { batchWrites, tablesRepo } from "../data/index.ts";
import { kindOffers } from "../domain/index.ts";
import type { WeakSpotEventRow } from "../domain/index.ts";
import { linkKey } from "./ids.ts";
import { CommandError, flushWrites } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { logAttempt, talkLine } from "./handlers-edit.ts";

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

/** The live weak spot -> goal link rows between a spot and a date (§data.links). */
const spotLinks = async (x: HandlerCtx, id: string, goal: string) =>
  (await tables(x).links.list()).filter(
    (l) =>
      l.from_kind === "weak_spot" &&
      l.from_id === id &&
      l.to_kind === "goal" &&
      l.to_id === goal,
  );

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
  // A weak spot points at its date with one link row (§data.links); linking twice keeps the one row, unlinking removes it.
  "weakspot.link": async (i: { id: string; goal: string }, _c, x) => {
    await need(x, i.id);
    const g = await tables(x).goals.get(i.goal);
    if (!g) throw new CommandError(404, `no date ${i.goal}`);
    if (!kindOffers(g.kind, "weak-spot-links"))
      throw new CommandError(409, `${g.title} does not take weak spots`);
    const have = (await spotLinks(x, i.id, i.goal))[0];
    if (have) return { id: i.id, goal: i.goal, link: have.id };
    const link = linkKey(x.newId());
    const r = await tables(x).links.save(
      {
        id: link,
        from_kind: "weak_spot",
        from_id: i.id,
        to_kind: "goal",
        to_id: i.goal,
        by: "user",
        note: null,
      },
      null,
    );
    if (!r.ok) throw new CommandError(409, "that changed; try again");
    return { id: i.id, goal: i.goal, link };
  },
  "weakspot.unlink": async (i: { id: string; goal: string }, _c, x) => {
    await need(x, i.id);
    // Every link row removed is ONE batch: all go or none does (§data.gate).
    const w = batchWrites(x.db);
    const t = tablesRepo(w.db, { clock: x.clock });
    for (const l of await spotLinks(x, i.id, i.goal))
      await t.links.remove(l.id, l.v);
    await flushWrites(w);
    return { id: i.id, goal: i.goal };
  },
  // The reply Matt asked to be told is logged; the answer itself is on the Ask screen.
  "ask.just_tell_me": async (i: { id: string; attempt?: string }, _c, x) => {
    // The talk line and the attempts row are ONE batch: both land or neither does (§data.gate).
    const w = batchWrites(x.db);
    const d = { ...x, db: w.db };
    const line = await talkLine(d, { text: "Just tell me", replyTo: i.id });
    // One log-only attempts row: an ask turn is not a set item, so the turn asked about stands in for it.
    const attempt = await logAttempt(d, {
      id: i.attempt,
      item_id: i.id,
      set_id: "ask",
      session_id: null,
      source: "ask",
      how: "told",
      answer: { line },
    });
    await flushWrites(w, "that changed or was already recorded; try again");
    return { id: i.id, told: true, attempt };
  },
};
