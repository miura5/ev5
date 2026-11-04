import { z } from 'zod';
import { defineCommand, ref } from './define.ts';

const M = { matt: 'direct' } as const;
const to = z.object({ id: z.string().min(1), collection: z.string().min(1) });

// Any item (PLAN §6.1). Delete goes to Recently deleted; nothing here purges (§hard.data-never-lost).
export const itemCommands = [
  defineCommand({ name: 'item.open', title: 'Open', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'item.pin', title: 'Pin', input: ref, callers: M, effect: 'instant', undo: 'item.unpin' }),
  defineCommand({ name: 'item.unpin', title: 'Unpin', input: ref, callers: M, effect: 'instant', undo: 'item.pin' }),
  defineCommand({ name: 'item.move', title: 'Move to a collection', input: to, callers: M, effect: 'instant' }),
  defineCommand({ name: 'item.delete', title: 'Delete', input: ref, callers: M, effect: 'instant', undo: 'item.restore' }),
  defineCommand({ name: 'item.restore', title: 'Restore', input: ref, callers: M, effect: 'instant' }),
  defineCommand({
    name: 'item.rename',
    title: 'Rename',
    input: z.object({ id: z.string().min(1), title: z.string().min(1) }),
    callers: M,
    effect: 'instant',
  }),
  defineCommand({
    name: 'collection.create',
    title: 'New collection',
    input: z.object({ title: z.string().min(1) }),
    callers: M,
    effect: 'instant',
    palette: true, places: ['library', 'notes'],
  }),
  defineCommand({
    name: 'collection.new_here',
    title: 'New note, set, date or collection here',
    input: z.object({ collection: z.string().min(1), kind: z.enum(['note', 'set', 'date', 'collection']) }),
    callers: M,
    effect: 'instant',
  }),
] as const;
