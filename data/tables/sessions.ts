// The one writer of study sessions on the tables gate (§data.tables, §data.gate, §data.append-only): a session is a row in
// `sessions`, and every event of it is one appended `session_events` row, never a rewrite of a document. An event's `at` is the
// instant it happened (the clock is rebuilt from it), not the instant it was stored.
import type {
  NewSessionEventRow,
  SessionEventRow,
  SessionTableRow,
} from "../../domain/index.ts";
import type { D1Like } from "../d1.ts";
import type { TablesOptions } from "./core.ts";
import { WriteRefused } from "./gate.ts";
import { kindsRepo, type Fields } from "./kinds.ts";

export interface StoredSession {
  row: SessionTableRow;
  events: SessionEventRow[];
}

export function sessionsRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  const events = async (id: string) =>
    (await k.sessionEvents.list({ where: { session_id: id } })).sort(
      (a, b) => a.at - b.at || a.id.localeCompare(b.id),
    );
  return {
    sessionBook: {
      /** One live session with its events in time order, or null; `deleted: true` also finds a deleted one (for restore). */
      get: async (
        id: string,
        o: { deleted?: boolean } = {},
      ): Promise<StoredSession | null> => {
        const row = await k.sessions.get(id, o);
        return row ? { row, events: await events(id) } : null;
      },
      /** Every live session with its events, in id order. */
      list: async (): Promise<StoredSession[]> => {
        const [rows, all] = await Promise.all([
          k.sessions.list(),
          k.sessionEvents.list(),
        ]);
        return rows.map((row) => ({
          row,
          events: all
            .filter((e) => e.session_id === row.id)
            .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
        }));
      },
      /** The sessions still running (active or ending). */
      running: async () => [
        ...(await k.sessions.list({ where: { status: "active" } })),
        ...(await k.sessions.list({ where: { status: "ending" } })),
      ],
      /** Creates a session (a new id); a repeated id is a conflict. */
      create: (s: Fields<SessionTableRow>) => k.sessions.save(s, null),
      /** Changes a session at the version read. */
      change: (s: Fields<SessionTableRow>, ifVersion: number) =>
        k.sessions.save(s, ifVersion),
      /**
       * Appends one event to a live session. An id already stored is the same event again (a retry): nothing is doubled and
       * the answer is false.
       */
      append: async (e: NewSessionEventRow): Promise<boolean> => {
        if (!(await k.sessions.get(e.session_id)))
          throw new WriteRefused(
            "session_events",
            `${e.session_id} is not a session`,
          );
        const { at, ...fields } = e;
        const own = kindsRepo(db, { ...opts, clock: () => at });
        return (await own.sessionEvents.add(fields)).ok;
      },
    },
  };
}
