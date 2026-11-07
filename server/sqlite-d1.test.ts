// A real SQLite behind D1's interface for tests; batch is one transaction.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "../jobs/index.ts";

export function sqliteD1(): D1Like {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../data/migrations/0000_baseline.sql", import.meta.url),
      "utf8",
    ),
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
    async batch(statements: Parameters<D1Like["batch"]>[0]) {
      sql.exec("BEGIN");
      try {
        // Like D1, each result carries `meta.changes`.
        const out = statements.map((s) => {
          const r = (
            s as unknown as { exec: () => { changes: number } }
          ).exec();
          return { ...r, meta: { changes: r.changes } };
        });
        sql.exec("COMMIT");
        return out;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Like;
}

/** A note row for a test: `docId` is the document id (`n-…`), `text` its one line of words. */
export const putNoteRow = (
  db: D1Like,
  docId: string,
  title: string,
  text: string,
) =>
  db
    .prepare(
      "INSERT INTO notes (id, title, body, text, at, v) VALUES (?, ?, ?, ?, 0, 1)",
    )
    .bind(
      docId,
      title,
      JSON.stringify({
        createdAt: "2026-11-01T10:00:00.000Z",
        source: "test",
        blocks: [{ type: "p", runs: [{ text }] }],
      }),
      text,
    )
    .run();
