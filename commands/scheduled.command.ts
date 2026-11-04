import { z } from 'zod';
import { defineCommand, none } from './define.ts';

// Scheduled commands (S) and the external executor's (X). weekly_review ends as a Needs-you item in Activity.
export const scheduledCommands = [
  defineCommand({ name: 'morning', title: 'Morning run', input: none, callers: { schedule: 'direct' }, effect: 'job', every: 'daily' }),
  defineCommand({ name: 'evening', title: 'Evening run', input: none, callers: { schedule: 'direct' }, effect: 'job', every: 'daily' }),
  defineCommand({ name: 'weekly_review', title: 'Weekly review', input: none, callers: { schedule: 'direct' }, effect: 'job', every: 'weekly:sun' }),
  defineCommand({ name: 'export', title: 'Export a backup', input: none, callers: { schedule: 'direct' }, effect: 'job', every: 'daily' }),
  defineCommand({ name: 'restore_drill', title: 'Restore drill', input: none, callers: { schedule: 'direct' }, effect: 'job', every: 'weekly:sun' }),
  defineCommand({ name: 'push_summary', title: 'Push summary', input: none, callers: { schedule: 'direct' }, effect: 'job', every: 'daily' }),
  // Fails jobs whose runner was lost (§job.record); runs on the 15-minute cron (wrangler triggers.crons).
  defineCommand({ name: 'job_sweep', title: 'Sweep stale jobs', input: none, callers: { schedule: 'direct' }, effect: 'instant', every: 'every:15m' }),
  defineCommand({
    name: 'canvas_sync',
    title: 'Canvas sync',
    input: z.object({ jobId: z.string().min(1) }),
    callers: { external: 'direct' },
    effect: 'instant',
  }),
] as const;
