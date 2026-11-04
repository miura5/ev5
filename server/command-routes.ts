// POST /api/v1/commands/:name (CONTRACT §cmd.registry, §cmd.propose, §sec.auth): runs a registry command for a caller.
// The token says who is calling (app = Matt, or E.V. when the app asks `as: "ev"`; schedule; executor = external);
// resolveCall then refuses a caller the command does not list. An E.V. propose call makes a Suggestion and runs nothing.
import { Hono } from "hono";
import {
  byName,
  paletteEntries,
  resolveCall,
  suggest,
  tools,
} from "../commands/index.ts";
import type { Caller as CommandCaller } from "../commands/index.ts";
import type { AuthVars } from "./auth.ts";
import { CommandError, commandHandlers } from "./command-handlers.ts";
import { saveSuggestion } from "./handlers-proposal.ts";
import type { DocsD1 } from "../data/index.ts";
import { askFromEnv } from "./ask-chat.ts";
import type { HandlerCtx } from "./handlers-core.ts";
import type { AskEnv } from "./ask-chat.ts";

/** A command with no handler here answers 501: the scheduled and job commands attach with their own tasks. */
export { commandHandlers };

const BY_TOKEN = {
  app: "matt",
  schedule: "schedule",
  executor: "external",
} as const;

export const commandRoutes = new Hono<{
  Bindings: { DB: DocsD1 } & Partial<
    Pick<AskEnv, "ANTHROPIC_API_KEY" | "ASK_CALL">
  > & { JOBS?: HandlerCtx["jobs"] };
  Variables: AuthVars;
}>();

// What the registry generates for the screens and E.V. (CONTRACT §cmd.generated); only the app token reads them.
commandRoutes.get("/commands/palette", (c) =>
  c.get("caller") === "app"
    ? c.json({ entries: paletteEntries() })
    : c.json({ error: "forbidden" }, 403),
);
commandRoutes.get("/commands/tools", (c) =>
  c.get("caller") === "app"
    ? c.json({ tools: tools() })
    : c.json({ error: "forbidden" }, 403),
);

commandRoutes.post("/commands/:name", async (c) => {
  const cmd = byName(c.req.param("name"));
  if (!cmd) return c.json({ error: "not found" }, 404);
  const b = (await c.req.json().catch(() => ({}))) as {
    input?: unknown;
    as?: unknown;
  };
  const token = c.get("caller");
  // Only the app token may speak for E.V. (its tool calls come through Matt's session).
  const caller: CommandCaller =
    token === "app" && b.as === "ev" ? "ev" : BY_TOKEN[token];
  const call = resolveCall(cmd, caller, b.input ?? {});
  if (!call.ok)
    return c.json(
      { error: call.reason },
      call.reason.endsWith(`may not call ${cmd.name}`) ? 403 : 400,
    );
  const ctx = {
    db: c.env.DB,
    clock: () => Date.now(),
    newId: () => crypto.randomUUID(),
    jobs: c.env.JOBS,
    ask: async (text: string) => {
      const r = await askFromEnv({ ...c.env, DB: c.env.DB as never }, text);
      if (!r.ok) throw new CommandError(r.status, r.reason);
      return { reply: r.reply, costCents: r.costCents };
    },
  };
  if (call.mode === "propose")
    return c.json(
      {
        mode: "propose",
        suggestion: await saveSuggestion(ctx, suggest(cmd, call.input)),
      },
      202,
    );
  const handler = commandHandlers[cmd.name];
  if (!handler) return c.json({ error: `${cmd.name} has no handler yet` }, 501);
  try {
    return c.json({
      mode: "direct",
      result: await handler(call.input as never, caller, ctx),
    });
  } catch (e) {
    if (e instanceof CommandError)
      return c.json({ error: e.message }, e.status);
    throw e;
  }
});
