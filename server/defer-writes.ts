// One command, one batch (CONTRACT §data.gate): a command that writes several rows runs its repositories on a database
// whose writes wait in a queue. Reads go straight through, every row is still parsed and size-checked by the gate, and
// `flush` sends the queued writes as ONE db.batch, so a failure midway leaves nothing half written. Each UPDATE is followed
// by a guard that fails the batch when it changed no row (a stale version), so the whole batch rolls back.
import type { DocsD1 as D1Like } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";

type D1Statement = ReturnType<D1Like["prepare"]>;
const STALE = "SELECT CASE WHEN changes() = 0 THEN json('refused') END";
const CONFLICT =
  /UNIQUE constraint failed|PRIMARY ?KEY|SQLITE_CONSTRAINT_(UNIQUE|PRIMARYKEY)|malformed JSON/i;

export function deferWrites(real: D1Like) {
  const queued: D1Statement[] = [];
  const db: D1Like = {
    prepare(sql) {
      let st = real.prepare(sql);
      const wrap: D1Statement = {
        bind: (...v) => {
          st = st.bind(...v);
          return wrap;
        },
        first: () => st.first(),
        all: () => st.all(),
        run: async () => {
          queued.push(st);
          if (/^\s*update\b/i.test(sql)) queued.push(real.prepare(STALE));
          return { meta: { changes: 1 } };
        },
      };
      return wrap;
    },
    batch: (s) => real.batch(s),
  };
  return {
    db,
    /** Sends the queued writes as one batch; a duplicate id or a stale version is a 409 and nothing was written. */
    async flush(conflict = "that changed; try again"): Promise<void> {
      if (!queued.length) return;
      try {
        await real.batch(queued.splice(0));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (CONFLICT.test(msg)) throw new CommandError(409, conflict);
        throw e;
      }
    },
  };
}
