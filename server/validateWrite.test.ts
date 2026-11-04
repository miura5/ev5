import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { validateWrite } from "../data/compat-test.ts";
import type { D1Like } from "../jobs/index.ts";
import { planHome } from "./plan-home.ts";

// A real SQLite behind D1's interface (the baseline and jobs migrations).
function sqliteD1(): D1Like & { sql: DatabaseSync } {
  const sql = new DatabaseSync(":memory:");
  for (const f of ["0000_baseline.sql", "0002_jobs_ceilings.sql"])
    sql.exec(
      readFileSync(new URL(`../data/migrations/${f}`, import.meta.url), "utf8"),
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
    };
    return st;
  };
  return {
    sql,
    prepare,
    batch: async (l: unknown[]) =>
      Promise.all((l as { run(): Promise<unknown> }[]).map((s) => s.run())),
  } as never;
}

const T = Date.parse("2026-11-03T12:00:00Z");

test("plan-home's plan and exam writes pass ev4's write check on their real output", async () => {
  const db = sqliteD1();
  const exam = {
    schema: 2,
    writer: "page",
    at: "2026-11-01T00:00:00Z",
    source: "t",
    title: "Unit 3",
    kind: "unit",
    date: "2026-11-10",
  };
  db.sql
    .prepare(
      "INSERT INTO docs (c, id, data, at, v) VALUES ('exams', 'e1', ?, 0, 1)",
    )
    .run(JSON.stringify(exam));
  db.sql
    .prepare(
      "INSERT INTO job_plans (job_id, kind, body, at) VALUES ('j1', 'context', ?, 0)",
    )
    .run(JSON.stringify({ exam: { id: "e1", title: "Unit 3" } }));
  await planHome(db, () => T).apply("j1", {
    summary: "Heart first",
    tasks: [
      {
        date: "2026-11-03",
        title: "Heart sounds",
        minutes: 30,
        weakSpotId: "w1",
      },
      { date: "2026-11-04", title: "Mixed", minutes: 25 },
    ],
  });
  const read = (c: string, id: string) =>
    JSON.parse(
      (
        db.sql
          .prepare("SELECT data FROM docs WHERE c=? AND id=?")
          .get(c, id) as { data: string }
      ).data,
    );
  assert.deepEqual(
    validateWrite("plans", read("plans", "plan-j1"), { id: "plan-j1" }),
    { ok: true },
  );
  assert.deepEqual(
    validateWrite("exams", read("exams", "e1"), { id: "e1", prev: exam }),
    { ok: true },
  );
});
