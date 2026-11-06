import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "../jobs/index.ts";
import { loadCeilingConfig, DEFAULT_CEILINGS } from "./job-run.ts";
import { planHome } from "./plan-home.ts";
import { weakSpotDocs } from "./weak-wire.ts";
import { deriveWeakSpot, parseWeakSpot } from "../domain/index.ts";
import type { DocsD1 } from "../data/index.ts";

// A real SQLite behind D1's interface (the baseline and jobs migrations).
function sqliteD1(): D1Like & { sql: DatabaseSync } {
  const sql = new DatabaseSync(":memory:");
  for (const f of [
    "0000_baseline.sql",
    "0001_deletions.sql",
    "0002_jobs_ceilings.sql",
    "0003_collections_pins_own.sql",
    "0004_ceiling_usage.sql",
    "0006_tables.sql",
  ])
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
// A weak spot is a row, in the course (collection) its exam names (§data.tables).
const row = (id: string, topic: string, collection: string, extra = "") =>
  `INSERT INTO weak_spots (id, collection_id, objective_id, topic, kind, words, source_line, duplicate_of, proposed, created_by, pre_read, reading_due, at, v) VALUES ('${id}', '${collection}', NULL, '${topic}', 'concept', NULL, 't', NULL, 0, 'user', 0, NULL, 0, 1)${extra}`;

function seeded() {
  const db = sqliteD1();
  put(db, "exams", "e1", {
    schema: 2,
    ...meta,
    title: "Unit 3",
    kind: "unit",
    course: "NUR 112",
    date: "2026-11-10",
  });
  db.sql.exec(
    "INSERT INTO collections (id, title, at) VALUES ('c1', 'NUR 112', 0), ('c2', 'BIO 201', 0)",
  );
  put(db, "exams", "e2", {
    schema: 2,
    ...meta,
    title: "Other",
    kind: "unit",
    course: "BIO 201",
    date: "2026-11-12",
  });
  db.sql.exec(row("ws_w1", "Heart sounds", "c1"));
  db.sql.exec(row("ws_w2", "Insulin", "c1"));
  db.sql.exec(row("ws_w3", "Other exam", "c2"));
  db.sql.exec(row("ws_w4", "Parked", "c1"));
  db.sql.exec(
    "INSERT INTO weak_spot_events (id, weak_spot_id, type, \"by\", note, objective_id, \"until\", at, v) VALUES ('wse_1', 'ws_w4', 'park', 'user', 'later', NULL, NULL, " +
      Date.parse("2026-11-02T10:00:00Z") +
      ", 1)",
  );
  return db;
}

test("load returns the exam, Central today and only this exam's active weak spots with their need", async () => {
  const home = planHome(seeded(), () => T);
  const got = (await home.load("e1"))!;
  assert.equal(got.today, "2026-11-03");
  assert.equal(got.exam.id, "e1");
  assert.deepEqual(got.spots.map((s) => [s.id, s.title, s.need]).sort(), [
    ["ws_w1", "Heart sounds", 2],
    ["ws_w2", "Insulin", 2],
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
          weakspotId: "ws_w1",
        },
      },
    },
  });
  const got = (await planHome(db, () => T).load("e1"))!;
  assert.ok(got.spots.find((s) => s.id === "ws_w1"));
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
        weakSpotId: "ws_w1",
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
  assert.equal(doc.days[0].tasks[0].ref, "ws_w1");
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
  // One tap: the plan is in force, written once (the repeat left it alone).
  const pe = db.sql
    .prepare("SELECT data, v FROM docs WHERE c='planedits' AND id='e1'")
    .get() as { data: string; v: number };
  assert.equal(JSON.parse(pe.data).plan, "plan-j1");
  assert.equal(pe.v, 1);
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

test("weak spots read as documents the screens parse: exam from the course, a tap's event derives its state", async () => {
  const db = seeded();
  db.sql.exec(
    "INSERT INTO weak_spot_events (id, weak_spot_id, type, \"by\", note, objective_id, \"until\", at, v) VALUES ('wse_abc', 'ws_w1', 'solid', 'user', NULL, NULL, NULL, " +
      Date.parse("2026-11-03T08:00:00Z") +
      ", 1)",
  );
  const docs = await weakSpotDocs(db as unknown as DocsD1, () => T);
  assert.deepEqual(docs.map((d) => [d.id, d.data.exam]).sort(), [
    ["ws_w1", "e1"],
    ["ws_w2", "e1"],
    ["ws_w3", "e2"],
    ["ws_w4", "e1"],
  ]);
  const w1 = docs.find((d) => d.id === "ws_w1")!;
  assert.equal(w1.data.course, "NUR 112");
  assert.equal(
    deriveWeakSpot(parseWeakSpot(w1.data), []).status,
    "reviewed",
    "mark as learned shows",
  );
});

test("a weak spot is created in its table, once, with no events and no docs row", async () => {
  const { createWeakSpot } = await import("./weak-wire.ts");
  const db = sqliteD1();
  db.sql.exec(
    "INSERT INTO collections (id, title, at) VALUES ('c1', 'NUR 112', 0)",
  );
  const doc = {
    schema: 2,
    ...meta,
    topic: "Heparin",
    objective: "",
    kind: "concept",
    initial: {},
    events: {},
    proposed: true,
    course: "NUR 112",
  };
  const made = await createWeakSpot(db as never, () => T, "ws_1", JSON.stringify(doc), null);
  assert.equal(made.ok, true);
  const spots = await weakSpotDocs(db as never, () => T);
  assert.equal(spots.length, 1);
  assert.equal(spots[0]?.data.course, "NUR 112");
  assert.equal(spots[0]?.data.proposed, true);
  assert.equal(db.sql.prepare("SELECT COUNT(*) n FROM docs").get()?.n, 0);
  const again = await createWeakSpot(db as never, () => T, "ws_1", JSON.stringify(doc), null);
  assert.equal(again.ok, false);
  const bad = await createWeakSpot(db as never, () => T, "x", "{}", null);
  assert.equal(!bad.ok && bad.status, 400);
});
