import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "../d1.ts";
import { tablesRepo } from "./tables.ts";
import { WriteRefused } from "./gate.ts";
import { insertConflict } from "./core.ts";

const dir = new URL("../migrations/", import.meta.url);
function make(
  onBad?: (b: { table: string; id: string; reason: string }) => void,
) {
  const db = new DatabaseSync(":memory:");
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

test("drafts: a change is pinned to the version read; plans and settings replace by key", async () => {
  const t = setup();
  await t.drafts.create({
    id: "d1",
    job_id: "ev",
    kind: "suggestion",
    target_kind: "commands",
    target_id: "x",
    body: {},
  });
  assert.equal(await t.drafts.edit("draft_d1", 2, "{}"), false);
  assert.equal(await t.drafts.edit("draft_d1", 1, '{"a":1}'), true);
  assert.equal(await t.drafts.claim("draft_d1", 1, "kept", "{}"), false);
  assert.equal(await t.drafts.claim("draft_d1", 2, "kept", '{"a":1}'), true);
  assert.equal(await t.drafts.reopen("draft_d1", 2), false);
  assert.equal(await t.drafts.reopen("draft_d1", 3), true);
  await t.jobPlans.put("j", "scope", { a: 1 });
  await t.jobPlans.put("j", "scope", { a: 2 });
  await t.settings.putNumbers({ k: 1 });
  await t.settings.putNumbers({ k: 2 });
});

test("a row the domain refuses is not written, and a bad stored row is skipped and reported", async () => {
  const bad: { table: string; id: string; reason: string }[] = [];
  const { db, repo } = make((b) => bad.push(b));
  // refused before the write: nothing reaches the table
  await assert.rejects(
    repo.collections.save({ id: "", title: "", parentId: null, pos: 0 }, null),
    (e) =>
      e instanceof WriteRefused &&
      /^collections: the row does not parse/.test(e.message),
  );
  // a refusal is never a 409: a stale version on a good row is the only conflict
  const big = await repo.collections
    .save({ ...good("c9"), title: "x".repeat(1_900_000) }, null)
    .catch((e: unknown) => e);
  assert.ok(
    big instanceof WriteRefused,
    "an oversize row is refused with a reason",
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
  assert.equal(bad[0]?.id, "c2");
  assert.equal(
    Object.getOwnPropertyDescriptor(list, "left_out")?.value,
    1,
    "the list says it left a row out",
  );
  assert.ok(!bad[0]?.reason.includes("{"), "the reason carries no row text");
});

test("an insert that fails for another reason is not reported as a conflict", async () => {
  const { db, repo } = make();
  db.exec(
    "CREATE TRIGGER no_insert BEFORE INSERT ON collections BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END",
  );
  const err = console.error;
  const logged: string[] = [];
  console.error = (m: string) => void logged.push(m);
  try {
    await assert.rejects(
      repo.collections.save(good("c1"), null),
      (e: Error) =>
        /insert into collections failed/.test(e.message) &&
        e.cause instanceof Error,
    );
  } finally {
    console.error = err;
  }
  assert.equal(logged.length, 1);
  assert.ok(!logged[0]?.includes("Unit 1"), "the log has no row text");
  // a unique or primary-key violation is still a conflict
  assert.equal(
    insertConflict("t", new Error("UNIQUE constraint failed: t.id")),
    true,
  );
  assert.equal(
    insertConflict("t", new Error("PRIMARY KEY must be unique")),
    true,
  );
  assert.throws(() =>
    insertConflict("t", new Error("NOT NULL constraint failed: t.id")),
  );
});

const good = (id: string) => ({
  id,
  title: "Unit 1",
  parentId: null,
  pos: 0,
});
