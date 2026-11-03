// A real SQLite behind D1's interface for tests; batch is one transaction.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "../jobs/index.ts";

export function sqliteD1(): D1Like {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../data/migrations/0002_jobs_ceilings.sql", import.meta.url),
      "utf8",
    ),
  );
  sql.exec(
    "CREATE TABLE claude_settings (key TEXT PRIMARY KEY, value INTEGER NOT NULL, at INTEGER NOT NULL)",
  );
  type Args = (string | number | null)[];
  const run = (text: string, args: Args) => {
    const st = sql.prepare(text);
    return /^\s*(select|with)/i.test(text)
      ? { rows: st.all(...args), changes: 0 }
      : { rows: [], changes: Number(st.run(...args).changes) };
  };
  const prepare = (text: string) => {
    let args: Args = [];
    const st = {
      bind: (...v: Args) => ((args = v), st),
      first: async () => run(text, args).rows[0] ?? null,
      all: async () => ({ results: run(text, args).rows }),
      run: async () => ({ meta: { changes: run(text, args).changes } }),
      exec: () => run(text, args),
    };
    return st;
  };
  return {
    prepare,
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const out = statements.map((s) =>
          (s as unknown as { exec: () => unknown }).exec(),
        );
        sql.exec("COMMIT");
        return out;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Like;
}
