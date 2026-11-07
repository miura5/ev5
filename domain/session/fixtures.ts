import type { SessionDoc, SessionEvent, SessionWrite } from './index.ts';

// Made-up session fixtures shared by the session tests (ported from the legacy sessions tests).
export const T0 = '2026-10-18T15:00:00.000Z';
export const plus = (min: number, sec = 0) => new Date(Date.parse(T0) + min * 60e3 + sec * 1e3).toISOString();
export const sk = (iso: string) => `page-${iso.replace(/[-:]/g, '').replace('T', '-').replace(/\.(\d+)Z$/, '$1')}`;
export const session = (events: Record<string, SessionEvent>, extra: Partial<SessionDoc> = {}): SessionDoc => ({
  id: 'ss-20261018-150000-ch-42',
  source: 'E.V. Home',
  status: 'active',
  topic: 'Ch 42 Fluids',
  startedAt: T0,
  events: {
    [sk(T0)]: { type: 'start' },
    ...Object.fromEntries(Object.entries(events).map(([t, e]) => [sk(t), e])),
  },
  ...extra,
});
export const base: Partial<SessionDoc> = {
  schema: 2,
  writer: 'page',
  at: T0,
  kind: 'note',
  date: '2026-10-18',
  planned: 25,
  noteId: 'note_20261018-150000-abcdefgh',
  note: 'notes/note_20261018-150000-abcdefgh',
};

function merge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = a[k];
    o[k] =
      v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object'
        ? merge(cur as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return o;
}
/** Applies the writes aimed at one session the way the record merges an `update`. */
export const apply = (doc: SessionDoc, writes: SessionWrite[]): SessionDoc =>
  writes.filter((w) => w.id === doc.id).reduce((d, w) => merge(d, w.data) as SessionDoc, doc);
