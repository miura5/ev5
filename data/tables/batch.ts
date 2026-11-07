// One command, one batch (CONTRACT §data.gate): the single way to send several writes as ONE db.batch, so a failure
// midway leaves nothing half written. `db` is a database whose writes wait in a queue (reads go straight through, every
// row is still parsed and size-checked by the gate); each UPDATE is followed by a guard that fails the batch when it
// changed no row (a stale version). `add` queues a prepared statement directly. `flush` sends the queue.
import type { D1Like } from "../d1.ts";

type D1Statement = ReturnType<D1Like["prepare"]>;
const STALE = "SELECT CASE WHEN changes() = 0 THEN json('refused') END";
const CONFLICT =
  /UNIQUE constraint failed|PRIMARY ?KEY|SQLITE_CONSTRAINT_(UNIQUE|PRIMARYKEY)|malformed JSON/i;

export function batchWrites(real: D1Like) {
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
    /** Queues an already prepared statement. */
    add(st: D1Statement): void {
      queued.push(st);
    },
    /** Sends the queue as one batch: false when a duplicate id or a stale version rolled it back (nothing written). */
    async flush(): Promise<boolean> {
      if (!queued.length) return true;
      try {
        await real.batch(queued.splice(0));
        return true;
      } catch (e) {
        if (CONFLICT.test(e instanceof Error ? e.message : String(e)))
          return false;
        throw e;
      }
    },
  };
}
