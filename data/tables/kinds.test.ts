import { test } from "node:test";
import assert from "node:assert/strict";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";
import { WriteRefused } from "./gate.ts";
import type { Fields } from "./kinds.ts";
import type { AttemptRow } from "../../domain/index.ts";

function make() {
  const db = migratedDb();
  const bad: { table: string; reason: string }[] = [];
  let now = 1_000;
  const repo = tablesRepo(sqliteD1(db), {
    clock: () => (now += 1000),
    onBad: (b) => bad.push(b),
  });
  return { db, repo, bad };
}
const goal = {
  id: "goal_1",
  collection_id: null,
  title: "Midterm",
  kind: "midterm",
  date: null,
  status: "open",
  score: null,
  created_by: "user",
} as const;

test("a kind table: create, versioned change, stale write is the only 409", async () => {
  const { repo } = make();
  const a = await repo.goals.save(goal, null);
  assert.ok(a.ok && a.row.v === 1 && a.row.deleted_at === null);
  assert.deepEqual(await repo.goals.save(goal, null), {
    ok: false,
    conflict: true,
    current: 1,
  });
  const b = await repo.goals.save({ ...goal, title: "Final" }, 1);
  assert.ok(b.ok && b.row.v === 2 && b.row.title === "Final");
  assert.deepEqual(await repo.goals.save({ ...goal, title: "x" }, 1), {
    ok: false,
    conflict: true,
    current: 2,
  });
  assert.equal((await repo.goals.get("goal_1"))?.title, "Final");
});

test("a row the domain refuses throws WriteRefused and writes nothing", async () => {
  const { repo, db } = make();
  await assert.rejects(
    repo.goals.save({ ...goal, id: "nope_1" }, null),
    WriteRefused,
  );
  await assert.rejects(
    repo.goals.save({ ...goal, created_by: "matt" as "user" }, null),
    WriteRefused,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM goals").get()?.n, 0);
});

test("soft delete leaves a row out unless asked; restore brings it back", async () => {
  const { repo } = make();
  await repo.goals.save(goal, null);
  const gone = await repo.goals.remove("goal_1", 1);
  assert.ok(gone.ok && gone.row.v === 2 && gone.row.deleted_at !== null);
  assert.equal(await repo.goals.get("goal_1"), null);
  assert.deepEqual(await repo.goals.list(), []);
  assert.equal((await repo.goals.list({ deleted: true })).length, 1);
  assert.equal((await repo.goals.remove("goal_1", 1)).ok, false);
  const back = await repo.goals.restore("goal_1", 2);
  assert.ok(back.ok && back.row.deleted_at === null && back.row.v === 3);
  assert.equal((await repo.goals.list()).length, 1);
});

test("a bad stored row is reported and left out of a list", async () => {
  const { repo, db, bad } = make();
  await repo.goals.save(goal, null);
  db.exec(
    "INSERT INTO goals (id, title, kind, status, created_by, at, v) VALUES ('goal_2', 't', 'midterm', 'open', 'matt', 1, 1)",
  );
  assert.deepEqual(
    (await repo.goals.list()).map((g) => g.id),
    ["goal_1"],
  );
  assert.equal(bad.length, 1);
  assert.equal(bad[0]?.table, "goals");
  assert.equal(await repo.goals.get("goal_2"), null);
  assert.equal(bad.length, 2);
});

test("JSON columns round-trip and list filters by column", async () => {
  const { repo } = make();
  const s = await repo.sets.save(
    {
      id: "set_1",
      collection_id: null,
      kind: "own",
      title: null,
      source_kind: null,
      source_id: null,
      created_by: "user",
      job_id: null,
      focus: null,
      asked: null,
    },
    null,
  );
  assert.ok(s.ok);
  const body = {
    id: "q1",
    stem: "Which first?",
    options: ["a", "b"],
    correct: [0],
  };
  const i = await repo.setBook.addItem({
    id: "item_1",
    set_id: "set_1",
    pos: 1,
    type: "single",
    body,
    objective_id: null,
    weak_spot_id: null,
    source_ref: null,
  });
  assert.ok(i.ok, JSON.stringify(i));
  const got = await repo.setItems.list({ where: { set_id: "set_1" } });
  assert.deepEqual(got[0]?.body, body);
  assert.deepEqual(
    await repo.setItems.list({ where: { set_id: "set_9" } }),
    [],
  );
  await assert.rejects(
    repo.setItems.list({ where: { "1=1; --": "x" } }),
    /no column/,
  );
});

test("append-only tables add rows and refuse a repeated id", async () => {
  const { repo } = make();
  assert.equal("save" in repo.attempts, false);
  assert.equal("remove" in repo.attempts, false);
  const att: Fields<AttemptRow> = {
    id: "att_1",
    item_id: "item_1",
    item_v: 1,
    set_id: "set_1",
    session_id: null,
    source: "run",
    how: "chose",
    answer: { chosen: [0] },
    score: 1,
    answered_at: 5,
    was_due: null,
  };
  const a = await repo.attempts.add(att);
  assert.ok(a.ok && a.row.v === 1);
  assert.deepEqual((await repo.attempts.get("att_1"))?.answer, { chosen: [0] });
  assert.deepEqual(await repo.attempts.add(att), {
    ok: false,
    conflict: true,
    current: 1,
  });
  await assert.rejects(
    repo.attempts.add({ ...att, id: "att_2", item_v: 0 }),
    WriteRefused,
  );
  const e = await repo.weakSpotEvents.add({
    id: "wse_1",
    weak_spot_id: "ws_1",
    type: "snooze",
    by: "user",
    note: null,
    objective_id: null,
    until: "2026-11-09",
  });
  assert.ok(e.ok && e.row.until === "2026-11-09");
  await assert.rejects(
    repo.weakSpotEvents.add({
      id: "wse_2",
      weak_spot_id: "ws_1",
      type: "snooze",
      by: "user",
      note: null,
      objective_id: null,
      until: null,
    }),
    WriteRefused,
  );
});

test("every kind lists empty on a fresh database", async () => {
  const { repo } = make();
  for (const k of [
    "goals",
    "objectives",
    "links",
    "notes",
    "sets",
    "setItems",
    "setItemVersions",
    "weakSpots",
    "weakSpotEvents",
    "attempts",
    "sessions",
    "sessionEvents",
    "talk",
    "files",
  ] as const)
    assert.deepEqual(await repo[k].list(), [], k);
});

const plan = {
  id: "plan_1",
  goal_id: "goal_1",
  job_id: null,
  state: "in_force",
  title: null,
  from_day: "2026-11-05",
  to_day: "2026-11-12",
  summary: null,
} as const;
const planItem = {
  id: "pli_1",
  plan_id: null,
  day: "2026-11-06",
  pos: 1,
  title: "Read",
  minutes: null,
  time: null,
  origin: "morning",
  linked_kind: null,
  linked_id: null,
  repeat_id: "rep_1",
  done_at: null,
} as const;

test("plans: one in force per goal is a refusal, not a 409; items likewise per repeat and day", async () => {
  const { repo, db } = make();
  assert.ok((await repo.plans.save(plan, null)).ok);
  await assert.rejects(
    repo.plans.save({ ...plan, id: "plan_2" }, null),
    WriteRefused,
  );
  assert.ok(
    (await repo.plans.save({ ...plan, id: "plan_2", state: "draft" }, null)).ok,
  );
  const r = await repo.repeats.save(
    {
      id: "rep_1",
      title: "Read",
      minutes: null,
      time: null,
      rule: { every: "day" },
      from_day: "2026-11-05",
      to_day: null,
      linked_kind: null,
      linked_id: null,
    },
    null,
  );
  assert.ok(r.ok);
  assert.deepEqual((await repo.repeats.get("rep_1"))?.rule, { every: "day" });
  assert.ok((await repo.planItems.save(planItem, null)).ok);
  await assert.rejects(
    repo.planItems.save({ ...planItem, id: "pli_2" }, null),
    WriteRefused,
  );
  const same = await repo.planItems.save({ ...planItem, title: "Again" }, 1);
  assert.ok(same.ok && same.row.v === 2);
  assert.equal(db.prepare("SELECT count(*) AS n FROM plan_items").get()?.n, 1);
});

test("a kind list can bound a number column from below, and refuses an unknown column", async () => {
  const { db, repo } = make();
  for (const [id, at] of [
    ["ses_a", 1],
    ["ses_b", 5],
  ] as const)
    db.prepare(
      "INSERT INTO sessions (id, kind, day, status, topic, ended_at, at) VALUES (?, 'note', '2026-11-07', 'ended', 'T', ?, 1)",
    ).run(id, at);
  const ids = async (min: Record<string, number>) =>
    (await repo.sessions.list({ where: { status: "ended" }, min })).map(
      (r) => r.id,
    );
  assert.deepEqual(await ids({ ended_at: 3 }), ["ses_b"]);
  assert.deepEqual(await ids({ ended_at: 1 }), ["ses_a", "ses_b"]);
  await assert.rejects(ids({ nope: 1 }), /no column/);
});
