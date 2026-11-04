import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "../jobs/index.ts";
import { loadCeilingConfig, DEFAULT_CEILINGS } from "./job-run.ts";
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
const put = (
  db: ReturnType<typeof sqliteD1>,
  c: string,
  id: string,
  data: unknown,
) =>
  db.sql
    .prepare("INSERT INTO docs (c, id, data, at, v) VALUES (?, ?, ?, 0, 1)")
    .run(c, id, JSON.stringify(data));
const meta = { writer: "page", at: "2026-11-01T00:00:00Z", source: "t" };
const spot = (topic: string, exam: string | null, extra = {}) => ({
  schema: 2,
  ...meta,
  topic,
  objective: "o",
  kind: "concept",
  initial: { streak: 0, nextDue: "2026-11-03" },
  events: {},
  exam,
  ...extra,
});

function seeded() {
  const db = sqliteD1();
  put(db, "exams", "e1", {
    schema: 2,
    ...meta,
    title: "Unit 3",
    kind: "unit",
    date: "2026-11-10",
  });
  put(db, "weakspots", "w1", spot("Heart sounds", "e1"));
  put(
    db,
    "weakspots",
    "w2",
    spot("Insulin", "e1", { initial: { streak: 1, nextDue: "2026-11-04" } }),
  );
  put(db, "weakspots", "w3", spot("Other exam", "e2"));
  put(
    db,
    "weakspots",
    "w4",
    spot("Parked", "e1", {
      events: {
        "page-20261102-100000": {
          type: "park",
          note: "later",
          at: "2026-11-02T10:00:00Z",
        },
      },
    }),
  );
  put(db, "weakspots", "bad", { nonsense: true });
  return db;
}

test("load returns the exam, Central today and only this exam's active weak spots with their need", async () => {
  const home = planHome(seeded(), () => T);
  const got = (await home.load("e1"))!;
  assert.equal(got.today, "2026-11-03");
  assert.equal(got.exam.id, "e1");
  assert.deepEqual(got.spots.map((s) => [s.id, s.title, s.need]).sort(), [
    ["w1", "Heart sounds", 2],
    ["w2", "Insulin", 1],
  ]);
  assert.equal(await home.load("nope"), undefined);
});

test("answers on a weak spot count toward its need", async () => {
  const db = seeded();
  put(db, "answers", "a1", {
    schema: 2,
    ...meta,
    setId: "s",
    answers: {
      q1: {
        "page-20261102-090000": {
          correct: true,
          at: "2026-11-02T09:00:00Z",
          weakspotId: "w1",
        },
      },
    },
  });
  const got = (await planHome(db, () => T).load("e1"))!;
  assert.ok(got.spots.find((s) => s.id === "w1"));
});

test("apply puts the plan on Today (plans doc) and points the exam at it; repeating is safe", async () => {
  const db = seeded();
  db.sql
    .prepare(
      "INSERT INTO job_plans (job_id, kind, body, at) VALUES ('j1', 'context', ?, 0)",
    )
    .run(JSON.stringify({ exam: { id: "e1", title: "Unit 3" } }));
  const home = planHome(db, () => T);
  const plan = {
    summary: "Heart first",
    tasks: [
      {
        date: "2026-11-03",
        title: "Heart sounds",
        minutes: 30,
        weakSpotId: "w1",
      },
      { date: "2026-11-03", title: "Insulin", minutes: 20 },
      { date: "2026-11-04", title: "Mixed", minutes: 25 },
    ],
  };
  assert.equal(await home.apply("j1", plan), "plan-j1");
  assert.equal(await home.apply("j1", plan), "plan-j1");
  const doc = JSON.parse(
    (
      db.sql
        .prepare("SELECT data FROM docs WHERE c='plans' AND id='plan-j1'")
        .get() as { data: string }
    ).data,
  );
  assert.equal(doc.exam, "e1");
  assert.deepEqual(
    doc.days.map((d: { date: string; tasks: unknown[] }) => [
      d.date,
      d.tasks.length,
    ]),
    [
      ["2026-11-03", 2],
      ["2026-11-04", 1],
    ],
  );
  assert.equal(doc.days[0].tasks[0].ref, "w1");
  const exam = db.sql
    .prepare("SELECT data, v FROM docs WHERE c='exams' AND id='e1'")
    .get() as { data: string; v: number };
  assert.equal(JSON.parse(exam.data).planId, "plan-j1");
  assert.equal(exam.v, 2, "the exam was updated once, not on the repeat");
  // Stored as canonical JSON (compact, as ev4 stores it; §data.protocol) and as a v5 write; an exam keeps its envelope
  // (a Fact's writer and source are write-once). The ev4 contract check on this output needs a Node-only test door.
  const text = (id: string, c: string) =>
    (
      db.sql.prepare("SELECT data FROM docs WHERE c=? AND id=?").get(c, id) as {
        data: string;
      }
    ).data;
  assert.equal(text("plan-j1", "plans"), JSON.stringify(doc));
  assert.equal(exam.data, JSON.stringify(JSON.parse(exam.data)));
  const stored = JSON.parse(exam.data);
  assert.equal(stored.writer, "page");
  assert.equal(stored.source, "t");
  assert.equal(doc.source, "v5/job:j1");
});

test("ceilings use the documented defaults when unset and a stored value wins", async () => {
  const db = sqliteD1();
  assert.deepEqual(await loadCeilingConfig(db), DEFAULT_CEILINGS);
  db.sql.exec(
    "INSERT INTO claude_settings VALUES ('ceiling_daily', 0, 0), ('ceiling_hourly', 7, 0)",
  );
  assert.deepEqual(await loadCeilingConfig(db), {
    ...DEFAULT_CEILINGS,
    daily: 0,
    hourly: 7,
  });
});
