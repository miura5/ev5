// Test-only: a D1 stand-in over node:sqlite (real SQL), so exports and restores run against real tables.
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "../docs/d1.ts";

export function sqliteD1(db: DatabaseSync): D1Like {
  const prepare = (sql: string): D1Statement => {
    let args: (string | number | null)[] = [];
    const st: D1Statement = {
      bind: (...v) => ((args = v), st),
      first: async <T>() => (db.prepare(sql).get(...args) ?? null) as T | null,
      all: async <T>() => ({ results: db.prepare(sql).all(...args) as T[] }),
      run: async () => ({
        meta: { changes: Number(db.prepare(sql).run(...args).changes) },
      }),
    };
    return st;
  };
  return {
    prepare,
    async batch(sts) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of sts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

/** An in-memory database with every migration in data/migrations applied, in order. */
export function migratedDb(): DatabaseSync {
  const dir = new URL("../migrations/", import.meta.url);
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir)
    .filter((n) => /^\d+_.*\.sql$/.test(n))
    .sort())
    db.exec(readFileSync(new URL(f, dir), "utf8"));
  return db;
}
