// The command registry's one definition (CONTRACT §cmd.registry, §cmd.propose). Nothing here runs a command: it
// declares who may call it, how, and what it starts; handlers attach elsewhere by name.
import { z } from 'zod';

/** The input shapes most commands share. */
export const ref = z.object({ id: z.string().min(1) });
export const none = z.object({});

export type Caller = 'matt' | 'ev' | 'schedule' | 'external';
export type Mode = 'direct' | 'propose';
export type Effect = 'instant' | 'job';

export interface CommandSpec<S extends z.ZodType = z.ZodType> {
  name: string;
  title: string;
  /** What E.V.'s tool description says. Defaults to the title. */
  description?: string;
  input: S;
  /** Each allowed caller and its mode. Absent means the caller may not call it. */
  callers: Partial<Record<Caller, Mode>>;
  effect: Effect;
  /** True when it changes Matt's plan, lists or schedule: E.V. may then only propose it. */
  changesPlan?: boolean;
  /** The command that reverses it, where the mock-up shows Undo. */
  undo?: string;
  /** Cadence of a schedule entry, e.g. "daily", "weekly:sun". */
  every?: string;
  /** Show in ⌘K (Matt's commands that need no more than a typed word). Default false. */
  palette?: boolean;
  /** Area ids where ⌘K offers it (§ui.palette). Absent means everywhere. */
  places?: readonly string[];
}

export type Command<S extends z.ZodType = z.ZodType> = Readonly<CommandSpec<S>>;

// E.V. can never call these (§cmd.propose): delete, restore, pin, approve, keep or drop, mark as learned, "just tell me".
const NEVER_EV = /(?:^|[._])(?:delete|restore|pin|unpin|approve|accept|keep|drop|keep_all|drop_all|mark_learned|just_tell_me)(?:$|[._])/;
const NAME = /^[a-z]+(?:\.[a-z_]+|_[a-z_]+)?$/;

export function defineCommand<S extends z.ZodType>(spec: CommandSpec<S>): Command<S> {
  const fail = (why: string): never => {
    throw new Error(`command ${spec.name}: ${why}`);
  };
  if (!NAME.test(spec.name)) fail('name must be lower-case, like item.pin or weekly_review');
  if (!Object.keys(spec.callers).length) fail('needs at least one caller');
  if (spec.callers.ev) {
    if (NEVER_EV.test(spec.name)) fail('E.V. can never call this');
    if (spec.changesPlan && spec.callers.ev !== 'propose') fail('E.V. changes Matt\'s plan only in propose mode');
  }
  if (spec.every && !spec.callers.schedule) fail('a cadence needs the schedule caller');
  if (spec.callers.schedule && !spec.every) fail('the schedule caller needs a cadence');
  return Object.freeze(spec);
}

export type Call =
  | { ok: true; mode: Mode; input: unknown }
  | { ok: false; reason: string };

/** Decide how a call runs: refuse a caller the command does not list, check the input, and return the mode. */
export function resolveCall(cmd: Command, caller: Caller, input: unknown): Call {
  const mode = cmd.callers[caller];
  if (!mode) return { ok: false, reason: `${caller} may not call ${cmd.name}` };
  const parsed = cmd.input.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
  return { ok: true, mode, input: parsed.data };
}

/** A Suggestion (a dashed card Matt accepts, edits or dismisses) made from an E.V. call in propose mode. */
export interface Suggestion {
  command: string;
  input: unknown;
  title: string;
}

export function suggest(cmd: Command, input: unknown): Suggestion {
  return { command: cmd.name, input, title: cmd.title };
}
