// On first boot, offer the notes ev4 left unsent in its IndexedDB outbox (PLAN §9, CONTRACT §data.ev4-routes).
// ev4's database is only ever read (CONTRACT §hard.ev4-own-process): nothing is opened for upgrade, written or deleted.
// ev4's entry (pwa/bridge.js): key "<tab>\n<c>\n<id>" -> { tab, c, id, doc, base, tag, refused?, from? } in store
// 'outbox' of database 'ev-app'.
import type { Outbox } from './outbox.ts';

export const EV4_DB = 'ev-app';
const EV4_BOX = 'outbox';

export interface Ev4Entry {
  c: string;
  id: string;
  doc: unknown;
  base: number | null;
  refused?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The note entries in what ev4's outbox store holds; anything of another shape is ignored. */
export function ev4Entries(rows: unknown[]): Ev4Entry[] {
  const out: Ev4Entry[] = [];
  for (const r of rows) {
    if (!isObj(r) || r.c !== 'notes' || typeof r.id !== 'string' || !isObj(r.doc)) continue;
    const base = typeof r.base === 'number' ? r.base : null;
    out.push({ c: r.c, id: r.id, doc: r.doc, base, ...(typeof r.refused === 'string' ? { refused: r.refused } : {}) });
  }
  return out;
}

/** Every row of ev4's outbox on this device; [] when ev4 never ran here. Read-only, never creates the database. */
export async function readEv4Outbox(factory: IDBFactory = indexedDB): Promise<Ev4Entry[]> {
  const known = (await factory.databases?.()) ?? [];
  if (!known.some((d) => d.name === EV4_DB)) return [];
  const db = await new Promise<IDBDatabase>((ok, no) => {
    const q = factory.open(EV4_DB); // no version: an open that cannot upgrade
    q.onsuccess = () => ok(q.result);
    q.onerror = () => no(q.error);
  });
  try {
    if (!db.objectStoreNames.contains(EV4_BOX)) return [];
    const rows = await new Promise<unknown[]>((ok, no) => {
      const q = db.transaction(EV4_BOX, 'readonly').objectStore(EV4_BOX).getAll();
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
    return ev4Entries(rows);
  } finally {
    db.close();
  }
}

/**
 * Queue ev4's unsent notes in v5's outbox, each pinned to the version ev4 read it at, so a note changed since arrives as
 * an "(earlier)" copy instead of overwriting. The caller offers it once and remembers the answer: a second import of a
 * note that has since changed would make a second "(earlier)" copy.
 */
export async function importEv4Outbox(box: Outbox, entries: Ev4Entry[]): Promise<{ queued: number }> {
  for (const e of entries) await box.queueNote(e.id, e.doc as never, e.base);
  return { queued: entries.length };
}
