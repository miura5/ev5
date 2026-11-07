import { z } from 'zod';
import { defineCommand, ref } from './define.ts';

const M = { matt: 'direct' } as const;
const id = z.string().min(1);
const setItem = z.object({ set: id, item: id });

// Weak spots, sets, and studying (PLAN §6.1). E.V. proposes weak spots only through the weekly review and practice.
// The "just tell me" commands are logged by their handler and are never E.V.'s.
export const practiceCommands = [
  defineCommand({ name: 'weakspot.drill', title: 'Drill a weak spot', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'weakspot.mark_learned', title: 'Mark a weak spot learned', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'weakspot.confirm', title: 'Confirm a proposed weak spot', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'weakspot.decline', title: 'Decline a proposed weak spot', input: ref, callers: M, effect: 'instant' }),
  // A weak spot is linked to a date with a link row (§data.links); only a date whose kind offers weak-spot-links takes it.
  defineCommand({ name: 'weakspot.link', title: 'Link a weak spot to a date', input: z.object({ id, goal: id }), callers: M, effect: 'instant', undo: 'weakspot.unlink' }),
  defineCommand({ name: 'weakspot.unlink', title: 'Unlink a weak spot from a date', input: z.object({ id, goal: id }), callers: M, effect: 'instant', undo: 'weakspot.link' }),
  defineCommand({ name: 'weeklyreview.done', title: 'Finish the weekly review', input: ref, callers: M, effect: 'instant' }),
  defineCommand({
    name: 'set.create',
    title: 'New set',
    input: z.object({ title: z.string().min(1), type: z.string().optional(), collection: z.string().optional() }),
    callers: M,
    effect: 'instant',
    palette: true, places: ['library'],
  }),
  defineCommand({
    name: 'set.update',
    title: 'Change a set',
    input: z.object({ id, title: z.string().optional(), type: z.string().optional(), collection: z.string().optional(), source: z.string().optional(), if_version: z.number().int().min(1) }),
    callers: M,
    effect: 'instant',
  }),
  defineCommand({ name: 'set.item_add', title: 'Add an item to a set', input: z.object({ set: id, text: z.string().min(1) }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'set.item_update', title: 'Change an item in a set', input: setItem.extend({ text: z.string().min(1), if_version: z.number().int().min(1) }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'set.item_delete', title: 'Remove an item from a set', input: setItem, callers: M, effect: 'instant' }),
  defineCommand({ name: 'set.done', title: 'Finish editing a set', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'set.write_with_ev', title: 'Write this set with E.V.', input: ref, callers: M, effect: 'job' }),
  defineCommand({ name: 'set.unverified_keep', title: 'Keep an unverified item', input: setItem, callers: M, effect: 'instant' }),
  defineCommand({ name: 'set.unverified_drop', title: 'Drop an unverified item', input: setItem, callers: M, effect: 'instant' }),
  defineCommand({ name: 'set.save', title: 'Save the set', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'study.start', title: 'Start studying', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'study.attempt', title: 'Answer a question', input: z.object({ id, answer: z.string(), rating: z.enum(['again', 'good']).optional(), attempt: z.string().startsWith('att_').optional(), answered_at: z.number().int().optional() }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'study.reveal', title: 'Show the answer', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'study.just_tell_me', title: 'Just tell me', input: z.object({ id, attempt: z.string().startsWith('att_').optional(), answered_at: z.number().int().optional() }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'study.leave', title: 'Leave studying', input: ref, callers: M, effect: 'instant' }),
] as const;
