// What a command handler is, shared by the handler files so none imports another (CONTRACT §cmd.registry).
import type { Caller } from "../commands/index.ts";
import type { DocsD1 } from "../data/index.ts";

/** A refusal with its HTTP status, raised by a handler and turned into JSON by the route. */
export class CommandError extends Error {
  readonly status: 400 | 404 | 409 | 429 | 501 | 502 | 503;
  constructor(
    status: 400 | 404 | 409 | 429 | 501 | 502 | 503,
    message: string,
  ) {
    super(message);
    this.status = status;
  }
}

export interface HandlerCtx {
  db: DocsD1;
  clock: () => number;
  newId: () => string;
  /** Asks E.V. one question on the same path as POST /ask; the route supplies it from the Worker's bindings. */
  ask?: (text: string) => Promise<unknown>;
}
export type CommandHandler = (
  input: never,
  caller: Caller,
  ctx: HandlerCtx,
) => Promise<unknown>;
