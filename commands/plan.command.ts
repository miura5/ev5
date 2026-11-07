import { z } from 'zod';
import { defineCommand, ref } from './define.ts';
import { DATE_KINDS, planItemInputSchema, planItemPatchSchema } from '../domain/index.ts';

const M = { matt: 'direct' } as const;
const MP = { matt: 'direct', ev: 'propose' } as const;
const id = z.string().min(1);
/** A date's kind is one of the registry's kinds (domain/goal); a new date without one is "other". */
const kind = z.enum(Object.keys(DATE_KINDS) as [string, ...string[]]).optional();
const planItem = planItemInputSchema;
const planPatch = planItemPatchSchema;

// Plan items, proposals and drafts, dates and the prep plan (PLAN §6.1). E.V. proposes; Matt accepts.
export const planCommands = [
  defineCommand({ name: 'plan.create', title: 'Add a plan item', input: planItem, callers: MP, effect: 'instant', changesPlan: true, palette: true, places: ['today'] }),
  defineCommand({ name: 'plan.update', title: 'Change a plan item', input: planPatch, callers: MP, effect: 'instant', changesPlan: true }),
  defineCommand({ name: 'plan.toggle_done', title: 'Mark a plan item done or not', input: ref, callers: M, effect: 'instant', undo: 'plan.toggle_done' }),
  defineCommand({ name: 'plan.move_tomorrow', title: 'Move to tomorrow', input: ref, callers: MP, effect: 'instant', changesPlan: true }),
  defineCommand({ name: 'plan.start', title: 'Start a plan item', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'plan.start_next', title: 'Start the next plan item', input: z.object({}), callers: M, effect: 'instant' }),
  defineCommand({ name: 'proposal.accept', title: 'Accept a Suggestion', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'proposal.edit', title: 'Edit a Suggestion', input: z.object({ id, input: z.record(z.string(), z.unknown()) }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'proposal.dismiss', title: 'Dismiss a Suggestion', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'draft.keep', title: 'Keep a draft', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'draft.drop', title: 'Drop a draft', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'draft.keep_all', title: 'Keep all drafts', input: z.object({ set: id }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'draft.drop_all', title: 'Drop all drafts', input: z.object({ set: id }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'date.create', title: 'Add a date', input: z.object({ title: z.string().min(1), date: z.string().min(1), kind, objectives: z.array(id).optional() }), callers: MP, effect: 'instant', changesPlan: true, palette: true, places: ['today'] }),
  defineCommand({ name: 'date.update', title: 'Change a date', input: z.object({ id, title: z.string().optional(), date: z.string().optional(), kind }), callers: MP, effect: 'instant', changesPlan: true }),
  defineCommand({ name: 'date.plan_with_ev', title: 'Plan this date with E.V.', input: ref, callers: M, effect: 'job' }),
  defineCommand({ name: 'plan.approve', title: 'Approve the prep plan', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'plan.ask_changes', title: 'Ask for changes to the prep plan', input: z.object({ id, note: z.string().min(1) }), callers: M, effect: 'job' }),
  defineCommand({ name: 'plan.put_away', title: 'Put the prep plan away', input: ref, callers: M, effect: 'instant' }),
] as const;
