import { z } from 'zod';
import { defineCommand, none } from './define.ts';

const M = { matt: 'direct' } as const;

export const shellCommands = [
  defineCommand({ name: 'palette.open', title: 'Open the command palette', input: none, callers: M, effect: 'instant' }),
  defineCommand({ name: 'palette.to_ev', title: 'Send the palette text to E.V.', input: z.object({ text: z.string() }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'theme.toggle', title: 'Switch light and dark', input: none, callers: M, effect: 'instant', palette: true }),
  defineCommand({ name: 'notes.shortcuts', title: 'Note shortcuts', input: none, callers: M, effect: 'instant', palette: true, places: ['notes'] }),
  defineCommand({
    name: 'nav.go',
    title: 'Go to a place',
    input: z.object({ to: z.string().min(1) }),
    callers: M,
    effect: 'instant',
    palette: true,
  }),
] as const;
