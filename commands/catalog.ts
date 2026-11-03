// Everything generated from the registry (CONTRACT §cmd.generated): E.V.'s tools and descriptions, ⌘K entries and the
// schedule. Nothing here is hand-listed; add a command in a *.command.ts file and these follow.
import { z } from 'zod';
import type { Command } from './define.ts';
import { all } from './all.generated.ts';

export const commands: readonly Command[] = all;

export const byName = (name: string): Command | undefined => commands.find(c => c.name === name);

export interface Tool {
  name: string;
  description: string;
  input_schema: unknown;
}

/** The Claude tools for E.V. Dots become double underscores: tool names allow only letters, digits, _ and -. */
export function tools(): Tool[] {
  return commands
    .filter(c => c.callers.ev)
    .map(c => ({
      name: c.name.replace(/\./g, '__'),
      description: `${c.description ?? c.title}${c.callers.ev === 'propose' ? ' (makes a Suggestion for Matt to accept)' : ''}`,
      input_schema: z.toJSONSchema(c.input),
    }));
}

export interface PaletteEntry {
  name: string;
  title: string;
}

export function paletteEntries(): PaletteEntry[] {
  return commands.filter(c => c.callers.matt && c.palette).map(c => ({ name: c.name, title: c.title }));
}

export interface ScheduleEntry {
  name: string;
  every: string;
}

export function scheduleEntries(): ScheduleEntry[] {
  return commands.filter(c => c.callers.schedule).map(c => ({ name: c.name, every: c.every! }));
}
