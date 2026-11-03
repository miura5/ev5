import type { Draft, DraftBatch, DraftWrite } from './types.ts';

/** The id of a draft's copy in its home: derived from the draft, so the copy exists exactly once (§data.drafts). */
export const copyId = (draft: Draft): string => `draft-${draft.id}`;

/** The home a kept draft is copied into: [collection, row id]. */
function home(d: Draft): [string, string] {
  if (d.kind === 'set-item') return ['own_set_items', copyId(d)];
  if (d.kind === 'plan-item') return ['dayedits', d.targetId];
  return ['sets', copyId(d)];
}

/** The copy's body: the draft's body plus where it came from; an unverified keep is marked (PLAN §6, unsourced items). */
function copyBody(d: Draft, unverified: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = { ...d.body, draftId: d.id };
  if (d.kind === 'set-item') body.setId = d.targetId;
  if (unverified) body.unverified = true;
  return body;
}

/**
 * The batch that keeps one draft: the copy in its home, then the mark `kept`, all or nothing. Only a pending draft can
 * be kept; the mark carries the draft's version so a second keep (or a drop) racing this one loses.
 */
export function keep(draft: Draft, now: string, opts: { unverified?: boolean } = {}): DraftBatch {
  if (draft.state !== 'pending') throw new Error(`draft ${draft.id}: already ${draft.state}`);
  const [c, id] = home(draft);
  return {
    atomic: true,
    writes: [
      { op: 'insert', c, id, body: copyBody(draft, opts.unverified === true) },
      {
        op: 'mark',
        c: 'drafts',
        id: draft.id,
        state: 'kept',
        expectV: draft.v,
        at: now,
      },
    ],
  };
}

/** The batch that drops one pending draft: nothing is copied and nothing is deleted. */
export function drop(draft: Draft, now: string): DraftBatch {
  if (draft.state !== 'pending') throw new Error(`draft ${draft.id}: already ${draft.state}`);
  return {
    atomic: true,
    writes: [
      {
        op: 'mark',
        c: 'drafts',
        id: draft.id,
        state: 'dropped',
        expectV: draft.v,
        at: now,
      },
    ],
  };
}

/** One batch keeping every pending draft given; kept and dropped ones are skipped. */
export function keepAll(drafts: readonly Draft[], now: string): DraftBatch {
  const writes: DraftWrite[] = drafts.filter((d) => d.state === 'pending').flatMap((d) => keep(d, now).writes);
  return { atomic: true, writes };
}

/** "You kept N of M" for a job's drafts. */
export function keptTally(drafts: readonly Draft[]): {
  kept: number;
  total: number;
} {
  return {
    kept: drafts.filter((d) => d.state === 'kept').length,
    total: drafts.length,
  };
}
