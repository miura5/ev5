import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "../docs/d1.ts";
import { tablesRepo } from "./tables.ts";

const dir = new URL("../migrations/", import.meta.url);
function make(onBad?: (b: { table: string; reason: string }) => void) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("ev4-schema.fixture.sql", dir), "utf8"));
  for (const f of readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort())
    db.exec(readFileSync(new URL(f, dir), "utf8"));
  const d1: D1Like = {
    prepare(sql) {
      let args: (string | number | null)[] = [];
      const st: D1Statement = {
        bind: (...v) => ((args = v), st),
        first: async <T>() =>
          (db.prepare(sql).get(...args) ?? null) as T | null,
        all: async <T>() => ({ results: db.prepare(sql).all(...args) as T[] }),
        run: async () => ({
          meta: { changes: Number(db.prepare(sql).run(...args).changes) },
        }),
      };
      return st;
    },
    async batch(s) {
      return Promise.all(s.map((x) => x.run()));
    },
  };
  let now = 1_000;
  return {
    db,
    repo: tablesRepo(d1, { clock: () => (now += 1000), onBad }),
  };
}
const setup = () => make().repo;

test("collections and memberships: create, versioned change, stale write refused", async () => {
  const r = setup();
  const a = await r.collections.save(
    { id: "c1", title: "Cardio", parentId: null, pos: 1 },
    null,
  );
  assert.ok(a.ok && a.row.v === 1);
  assert.deepEqual(
    await r.collections.save(
      { id: "c1", title: "X", parentId: null, pos: 1 },
      null,
    ),
    { ok: false, conflict: true, current: 1 },
  );
  const b = await r.collections.save(
    { id: "c1", title: "Cardio 2", parentId: null, pos: 1 },
    1,
  );
  assert.ok(b.ok && b.row.v === 2);
  assert.equal(
    (
      await r.collections.save(
        { id: "c1", title: "late", parentId: null, pos: 1 },
        1,
      )
    ).ok,
    false,
  );
  assert.equal((await r.collections.list())[0]?.title, "Cardio 2");
  await r.memberships.save(
    { itemC: "notes", itemId: "n1", collectionId: "c1" },
    null,
  );
  assert.equal((await r.memberships.list("c1")).length, 1);
  assert.equal((await r.memberships.list("zzz")).length, 0);
  assert.equal(await r.memberships.remove("notes", "n1"), true);
  assert.equal(await r.memberships.get("notes", "n1"), null);
});

test("pins keep order and move by writing a position", async () => {
  const r = setup();
  await r.pins.set("notes", "a", 2);
  await r.pins.set("notes", "b", 1);
  await r.pins.set("notes", "a", 0);
  assert.deepEqual(
    (await r.pins.list()).map((p) => p.targetId),
    ["a", "b"],
  );
  assert.equal(await r.pins.remove("notes", "b"), true);
});

test("item properties round trip repeat, link and overrides", async () => {
  const r = setup();
  const p = {
    c: "dayedits",
    id: "p1",
    time: "08:30",
    repeat: null,
    linked: { c: "exams", id: "e1" },
    overrides: { minutes: 20 },
  };
  assert.ok((await r.itemProps.save(p, null)).ok);
  const got = await r.itemProps.get("dayedits", "p1");
  assert.deepEqual(got && { ...got, at: 0, v: 0 }, { ...p, at: 0, v: 0 });
  assert.equal((await r.itemProps.save({ ...p, time: null }, 1)).ok, true);
});

test("own sets, their items and append-only attempts", async () => {
  const r = setup();
  assert.ok(
    (
      await r.ownSets.save(
        {
          id: "s1",
          title: "Mine",
          type: "question",
          sourceC: null,
          sourceId: null,
        },
        null,
      )
    ).ok,
  );
  const body = {
    id: "q1",
    stem: "Which of these lowers a fever the fastest?",
    type: "single" as const,
    options: ["a", "b"],
    correct: [0],
    rationales: ["x", "y"],
  };
  assert.ok(
    (
      await r.ownSets.saveItem(
        { setId: "s1", itemId: "q1", pos: 1, body },
        null,
      )
    ).ok,
  );
  assert.equal((await r.ownSets.items("s1")).length, 1);
  const a = await r.ownAttempts.append({
    setId: "s1",
    itemId: "q1",
    key: "k1",
    body: { chosen: [0], correct: true },
  });
  assert.ok(a.ok);
  assert.equal((await r.ownAttempts.list("s1")).length, 1);
  assert.equal(
    (
      await r.ownAttempts.append({
        setId: "s1",
        itemId: "q1",
        key: "k2",
        body: { text: "" },
      })
    ).ok,
    true,
  );
});

test("drafts: a change is pinned to the version read; plans and settings replace by key", async () => {
  const t = setup();
  await t.drafts.create({
    id: "d1",
    jobId: "ev",
    kind: "suggestion",
    targetC: "commands",
    targetId: "x",
    body: "{}",
  });
  assert.equal(await t.drafts.edit("d1", 2, "{}"), false);
  assert.equal(await t.drafts.edit("d1", 1, '{"a":1}'), true);
  assert.equal(await t.drafts.claim("d1", 1, "kept", "{}"), false);
  assert.equal(await t.drafts.claim("d1", 2, "kept", '{"a":1}'), true);
  assert.equal(await t.drafts.reopen("d1", 2), false);
  assert.equal(await t.drafts.reopen("d1", 3), true);
  await t.deletions.markCollection("c1");
  assert.equal(await t.deletions.restore("collections", "c1"), 1);
  await t.jobPlans.put("j", "scope", { a: 1 });
  await t.jobPlans.put("j", "scope", { a: 2 });
  await t.settings.putNumbers({ k: 1 });
  await t.settings.putNumbers({ k: 2 });
});

test("a row the domain refuses is not written, and a bad stored row is skipped and reported", async () => {
  const bad: { table: string; reason: string }[] = [];
  const { db, repo } = make((b) => bad.push(b));
  // refused before the write: nothing reaches the table
  await assert.rejects(
    repo.collections.save({ id: "", title: "", parentId: null, pos: 0 }, null),
  );
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS n FROM collections").get() as { n: number })
      .n,
    0,
  );
  assert.ok((await repo.collections.save(good("c1"), null)).ok);
  // a row written around the repository (a hand edit) fails to parse
  db.prepare(
    "INSERT INTO collections (id, title, parent_id, pos, at, v) VALUES ('c2', '', NULL, 1, 5000, 1)",
  ).run();
  const list = await repo.collections.list();
  assert.deepEqual(
    list.map((c) => c.id),
    ["c1"],
  );
  assert.equal(bad.length, 1);
  assert.equal(bad[0]?.table, "collections");
});

test("restore clears only the named collection's row", async () => {
  const r = setup();
  await r.deletions.markCollection("x");
  await r.deletions.markOwnSetItem("s", "x");
  assert.equal(await r.deletions.restore("collections", "x"), 1);
  assert.equal(await r.deletions.restore("collections", "x"), 0);
  assert.equal(await r.deletions.restore("own_set_items", "s/x"), 1);
});

const good = (id: string) => ({
  id,
  title: "Unit 1",
  parentId: null,
  pos: 0,
});
