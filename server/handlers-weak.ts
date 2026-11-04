// Weak spots (CONTRACT §ev.capture, §ui.weak-spots): a weak spot is an ev4 `weakspots` document and everything Matt does to
// it is one appended event (accept, decline, solid); "mark as learned" is a status, never a delete. A spot E.V. proposed
// counts nowhere until Matt confirms it. "Just tell me" in Ask is logged as Matt's line in today's talk document.
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler } from "./handlers-core.ts";
import { addEvent, need, talkLine } from "./handlers-edit.ts";

const proposed = async (x: Parameters<CommandHandler>[2], id: string) => {
  const { data } = await need(x, "weakspots", id);
  if (data.proposed !== true)
    throw new CommandError(409, `${id} is not a proposed weak spot`);
};

export const weakHandlers: Record<string, CommandHandler> = {
  // Starting the drill is the screen's; the server agrees once the spot exists.
  "weakspot.drill": async (i: { id: string }, _c, x) => {
    await need(x, "weakspots", i.id);
    return { client: true, id: i.id };
  },
  "weakspot.mark_learned": async (i: { id: string }, _c, x) => {
    await addEvent(x, "weakspots", i.id, { type: "solid", by: "owner" });
    return { id: i.id, learned: true };
  },
  "weakspot.confirm": async (i: { id: string }, _c, x) => {
    await proposed(x, i.id);
    await addEvent(x, "weakspots", i.id, { type: "accept", by: "owner" });
    return { id: i.id, confirmed: true };
  },
  "weakspot.decline": async (i: { id: string }, _c, x) => {
    await proposed(x, i.id);
    await addEvent(x, "weakspots", i.id, { type: "decline", by: "owner" });
    return { id: i.id, declined: true };
  },
  // The reply Matt asked to be told is logged; the answer itself is on the Ask screen.
  "ask.just_tell_me": async (i: { id: string }, _c, x) => {
    await talkLine(x, { text: "Just tell me", replyTo: i.id }, "v5/ask");
    return { id: i.id, told: true };
  },
};
