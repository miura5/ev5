import { z } from 'zod';
import { defineCommand, ref } from './define.ts';

const M = { matt: 'direct' } as const;
const id = z.string().min(1);

// Notes, sessions, saved views, jobs and Ask E.V. (PLAN §6.1). note.make_cards and study.grade ship after cutover.
export const notesCommands = [
  defineCommand({ name: 'note.create', title: 'New note', input: z.object({ collection: z.string().optional() }), callers: M, effect: 'instant', palette: true, places: ['notes', 'library'] }),
  defineCommand({ name: 'note.save', title: 'Save a note', input: z.object({ id, body: z.string() }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'note.move', title: 'Move a note', input: z.object({ id, collection: id }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'session.start', title: 'Start a session', input: z.object({ plan: z.string().optional(), noteId: z.string().optional() }), callers: M, effect: 'instant', palette: true, places: ['today', 'sessions'] }),
  defineCommand({ name: 'session.pause', title: 'Pause the session', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'session.end', title: 'End the session', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'check.answer', title: 'Answer a check question', input: z.object({ id, answer: z.string() }), callers: M, effect: 'instant' }),
  defineCommand({ name: 'check.just_tell_me', title: 'Just tell me', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'job.stop', title: 'Stop a job', input: ref, callers: M, effect: 'instant' }),
  defineCommand({ name: 'job.retry_shorter', title: 'Retry a job, shorter', input: ref, callers: M, effect: 'job' }),
  defineCommand({ name: 'job.dismiss', title: 'Dismiss a finished job', input: ref, callers: M, effect: 'instant' }),
  // E.V. reads a job's state directly; it changes nothing.
  defineCommand({ name: 'job_status', title: 'Check a job', input: ref, callers: { ev: 'direct' }, effect: 'instant' }),
  defineCommand({ name: 'ask.send', title: 'Ask E.V.', input: z.object({ text: z.string().min(1) }), callers: M, effect: 'chat', palette: true }),
  defineCommand({ name: 'ask.just_tell_me', title: 'Just tell me', input: ref, callers: M, effect: 'job' }),
] as const;

