// The offline outbox's shapes (CONTRACT §data.offline): only note saves and practice answers queue.
import type { Note } from '../../domain/index.ts';

export type OutboxKind = 'note' | 'answer' | 'command';

/** One unsent write, kept on this device. For a `command` entry `c` is the command name, `id` its client-made att_ id,
 * and `doc` the command's input. `base` is the version it was read at (null: a create). */
export interface OutboxEntry {
  key: string;
  kind: OutboxKind;
  c: string;
  id: string;
  doc: Note | Record<string, unknown>;
  base: number | null;
  tag: string;
  at: number;
  /** Set when the server refused it for good; kept, unsent, until a new save of the note replaces it. */
  refused?: string;
}

/** Where entries live: IndexedDB in the page, a map in tests. `remove` only removes the entry still carrying `tag`. */
export interface OutboxStore {
  all(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  remove(key: string, tag: string): Promise<void>;
}

export interface PutAnswer {
  status: number;
  version?: number;
  text?: string;
}
export interface GetAnswer {
  status: number;
  version?: number;
  data?: unknown;
}

/** The two calls a replay makes. Both reject when there is no connection. */
export interface Transport {
  /** The note as the record holds it now (the notes row route), for a stale save. */
  get(id: string): Promise<GetAnswer>;
  /** Posts a command (commands/client `call`); a refusal answers with its status, no connection rejects. */
  command(name: string, input: unknown): Promise<PutAnswer>;
}

export interface ReplayResult {
  sent: number;
  /** earlier-copy notes made from stale saves, as [original id, earlier id] */
  kept: [string, string][];
  /** why the replay stopped early, if it did */
  stopped?: 'offline' | 'auth' | 'busy';
  refused: string[];
}
