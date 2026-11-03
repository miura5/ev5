// A D1 stand-in over node:sqlite for tests: D1's prepare/bind/all and a batch that is one transaction.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import type { D1Like, D1Statement } from './d1.ts';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

/** A fresh in-memory database with every migration applied. */
export function fakeD1(): D1Like & { sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  for (const f of readdirSync(MIGRATIONS).filter(n => /^\d{4}_.*\.sql$/.test(n)).sort())
    sqlite.exec(readFileSync(new URL(f, MIGRATIONS), 'utf8'));
  const stmt = (sql: string, args: unknown[]): D1Statement & { run(): void } => ({
    bind: (...v) => stmt(sql, v),
    all<T>() {
      return Promise.resolve({ results: sqlite.prepare(sql).all(...(args as never[])) as T[] });
    },
    run: () => void sqlite.prepare(sql).all(...(args as never[])),
  });
  return {
    sqlite,
    prepare: sql => stmt(sql, []),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        for (const s of statements) (s as ReturnType<typeof stmt>).run();
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
      return [];
    },
  };
}
