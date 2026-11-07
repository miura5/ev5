import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "./d1-stores.ts";

type D1Statement = ReturnType<D1Like["prepare"]>;

// A real SQLite behind D1's interface (fake-d1 only knows the docs statements): batch is one transaction.
export function sqliteD1(): D1Like {
  const sql = new DatabaseSync(":memory:");
  for (const f of [
    "0002_jobs_ceilings.sql",
    "0003_collections_pins_own.sql",
    "0004_ceiling_usage.sql",
    "0006_tables.sql",
    "0007_plans_drafts.sql",
  ])
    sql.exec(
      readFileSync(
        new URL(`../../data/migrations/${f}`, import.meta.url),
        "utf8",
      ),
    );
  const run = (text: string, args: (string | number | null)[]) => {
    const st = sql.prepare(text);
    return /^\s*(select|with)/i.test(text)
      ? { rows: st.all(...args), changes: 0 }
      : { rows: [], changes: Number(st.run(...args).changes) };
  };
  const prepare = (text: string): D1Statement => {
    let args: (string | number | null)[] = [];
    const st = {
      bind: (...v: (string | number | null)[]) => ((args = v), st),
      first: async () => (run(text, args).rows[0] ?? null) as never,
      all: async () => ({ results: run(text, args).rows as never[] }),
      run: async () => ({ meta: { changes: run(text, args).changes } }),
      exec: () => run(text, args),
    };
    return st as unknown as D1Statement;
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
  };
}
