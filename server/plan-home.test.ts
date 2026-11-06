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
    "0007_plans_drafts.sql",
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
// A weak spot is a row pointing at an objective; the objective is linked to its goal (§data.tables, §data.links).
const row = (
  id: string,
  topic: string,
  collection: string,
  objective: string,
) =>
  `INSERT INTO weak_spots (id, collection_id, objective_id, topic, kind, words, source_line, duplicate_of, proposed, created_by, pre_read, reading_due, at, v) VALUES ('${id}', '${collection}', '${objective}', '${topic}', 'concept', NULL, 't', NULL, 0, 'user', 0, NULL, 0, 1)`;
const objective = (id: string, collection: string, goal: string) =>
  `INSERT INTO objectives (id, collection_id, num, text, chapters, source_ref, created_by, at, v) VALUES ('${id}', '${collection}', 1, 'x', NULL, NULL, 'user', 0, 1);
   INSERT INTO links (id, from_kind, from_id, to_kind, to_id, "by", note, at, v) VALUES ('link_${id}', 'objective', '${id}', 'goal', '${goal}', 'user', NULL, 0, 1)`;

function seeded() {
  const db = sqliteD1();
  db.sql.exec(
    "INSERT INTO collections (id, title, at) VALUES ('col_c1', 'Biology', 0), ('col_c2', 'Spanish', 0)",
  );
  db.sql.exec(
    "INSERT INTO goals (id, collection_id, title, kind, date, status, score, created_by, at, v) VALUES ('goal_e1', 'col_c1', 'Unit 3', 'unit', '2026-11-10', 'open', NULL, 'user', 0, 1), ('goal_e2', 'col_c2', 'Other', 'unit', '2026-11-12', 'open', NULL, 'user', 0, 1)",
  );
  db.sql.exec(objective("obj_1", "col_c1", "goal_e1"));
  db.sql.exec(objective("obj_2", "col_c2", "goal_e2"));
  db.sql.exec(row("ws_w1", "Cell division", "col_c1", "obj_1"));
  db.sql.exec(row("ws_w2", "Photosynthesis", "col_c1", "obj_1"));
  db.sql.exec(row("ws_w3", "Other goal", "col_c2", "obj_2"));
  db.sql.exec(row("ws_w4", "Parked", "col_c1", "obj_1"));
  // A spot in the same collection whose objective is linked to nothing has no goal: no name is matched.
  db.sql.exec(row("ws_w5", "Unlinked", "col_c1", "obj_none"));
  db.sql.exec(
    "INSERT INTO weak_spot_events (id, weak_spot_id, type, \"by\", note, objective_id, \"until\", at, v) VALUES ('wse_1', 'ws_w4', 'park', 'user', 'later', NULL, NULL, " +
      Date.parse("2026-11-02T10:00:00Z") +
      ", 1)",
  );
  return db;
}

test("load returns the exam, Central today and only this exam's active weak spots with their need", async () => {
  const home = planHome(seeded(), () => T);
  const got = (await home.load("goal_e1"))!;
  assert.equal(got.today, "2026-11-03");
  assert.equal(got.exam.id, "goal_e1");
  assert.deepEqual(got.spots.map((s) => [s.id, s.title, s.need]).sort(), [
    ["ws_w1", "Cell division", 2],
    ["ws_w2", "Photosynthesis", 2],
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
  const got = (await planHome(db, () => T).load("goal_e1"))!;
  assert.ok(got.spots.find((s) => s.id === "ws_w1"));
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

test("weak spots read as documents the screens parse: goal from the objective's link, a tap's event derives its state", async () => {
  const db = seeded();
  db.sql.exec(
    "INSERT INTO weak_spot_events (id, weak_spot_id, type, \"by\", note, objective_id, \"until\", at, v) VALUES ('wse_abc', 'ws_w1', 'solid', 'user', NULL, NULL, NULL, " +
      Date.parse("2026-11-03T08:00:00Z") +
      ", 1)",
  );
  const docs = await weakSpotDocs(db as unknown as DocsD1, () => T);
  assert.deepEqual(docs.map((d) => [d.id, d.data.exam]).sort(), [
    ["ws_w1", "goal_e1"],
    ["ws_w2", "goal_e1"],
    ["ws_w3", "goal_e2"],
    ["ws_w4", "goal_e1"],
    ["ws_w5", null],
  ]);
  const w1 = docs.find((d) => d.id === "ws_w1")!;
  assert.equal('course' in w1.data, false);
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
    "INSERT INTO collections (id, title, at) VALUES ('col_c1', 'Biology', 0)",
  );
  const doc = {
    schema: 2,
    ...meta,
    topic: "Past tense",
    objective: "",
    kind: "concept",
    initial: {},
    events: {},
    proposed: true,
  };
  const made = await createWeakSpot(
    db as never,
    () => T,
    "ws_1",
    JSON.stringify(doc),
    null,
  );
  assert.equal(made.ok, true);
  const spots = await weakSpotDocs(db as never, () => T);
  assert.equal(spots.length, 1);
  assert.equal('course' in (spots[0]?.data ?? {}), false);
  assert.equal(spots[0]?.data.exam, null);
  assert.equal(spots[0]?.data.proposed, true);
  assert.equal(db.sql.prepare("SELECT COUNT(*) n FROM docs").get()?.n, 0);
  const again = await createWeakSpot(
    db as never,
    () => T,
    "ws_1",
    JSON.stringify(doc),
    null,
  );
  assert.equal(again.ok, false);
  const bad = await createWeakSpot(db as never, () => T, "x", "{}", null);
  assert.equal(!bad.ok && bad.status, 400);
});
