// POST /api/v1/commands/:name (CONTRACT §cmd.registry, §cmd.propose, §sec.auth): runs a registry command for a caller.
// The token says who is calling (app = Matt, or E.V. when the app asks `as: "ev"`; schedule; executor = external);
// resolveCall then refuses a caller the command does not list. An E.V. propose call makes a Suggestion and runs nothing.
import { Hono } from "hono";
import { byName, resolveCall, suggest } from "../commands/index.ts";
import type { Caller as CommandCaller } from "../commands/index.ts";
import type { AuthVars } from "./auth.ts";

/** Handlers attach by command name; a direct call to a command with none answers 501 until its task lands. */
export type CommandHandler = (input: unknown, caller: CommandCaller) => Promise<unknown>;
export const commandHandlers: Record<string, CommandHandler> = {};

const BY_TOKEN = { app: "matt", schedule: "schedule", executor: "external" } as const;

export const commandRoutes = new Hono<{ Variables: AuthVars }>();

commandRoutes.post("/commands/:name", async (c) => {
  const cmd = byName(c.req.param("name"));
  if (!cmd) return c.json({ error: "not found" }, 404);
  const b = (await c.req.json().catch(() => ({}))) as { input?: unknown; as?: unknown };
  const token = c.get("caller");
  // Only the app token may speak for E.V. (its tool calls come through Matt's session).
  const caller: CommandCaller = token === "app" && b.as === "ev" ? "ev" : BY_TOKEN[token];
  const call = resolveCall(cmd, caller, b.input ?? {});
  if (!call.ok) return c.json({ error: call.reason }, call.reason.endsWith(`may not call ${cmd.name}`) ? 403 : 400);
  if (call.mode === "propose") return c.json({ mode: "propose", suggestion: suggest(cmd, call.input) }, 202);
  const handler = commandHandlers[cmd.name];
  if (!handler) return c.json({ error: `${cmd.name} has no handler yet` }, 501);
  return c.json({ mode: "direct", result: await handler(call.input, caller) });
});
