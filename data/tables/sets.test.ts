import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";
import { WriteRefused } from "./gate.ts";

const set = {
  id: "set_1",
  collection_id: null,
  kind: "drill",
  title: "Cardiac",
  source_kind: null,
  source_id: null,
  created_by: "user",
  job_id: null,
  focus: null,
  asked: null,
} as const;
const item = {
  id: "item_1",
  set_id: "set_1",
  pos: 1,
  type: "single",
  body: { stem: "Which first?", options: ["a", "b"], correct: [0] },
  objective_id: null,
  weak_spot_id: null,
  source_ref: null,
} as const;

async function make() {
  let now = 1_000;
  const repo = tablesRepo(sqliteD1(migratedDb()), {
    clock: () => (now += 1000),
  });
  assert.ok((await repo.setBook.create(set)).ok);
  assert.ok((await repo.setBook.addItem(item)).ok);
  return repo;
}

test("a set reads back with its items in order", async () => {
  const repo = await make();
  await repo.setBook.addItem({ ...item, id: "item_0", pos: 0 });
  const r = await repo.setBook.read("set_1");
  assert.deepEqual(
    r?.items.map((i) => i.id),
    ["item_0", "item_1"],
  );
  assert.equal(await repo.setBook.read("set_9"), null);
});

test("an item cannot join a set that does not exist", async () => {
  const repo = await make();
  await assert.rejects(
    repo.setBook.addItem({ ...item, id: "item_2", set_id: "set_9" }),
    WriteRefused,
  );
});

test("an edit files the replaced body and bumps v", async () => {
  const repo = await make();
  const body = { stem: "Which second?", options: ["a", "b"], correct: [1] };
  const e = await repo.setBook.editItem("item_1", { body }, 1);
  assert.ok(e.ok && e.row.v === 2 && e.row.id === "item_1");
  const old = await repo.setItemVersions.get("item_1@1");
  assert.deepEqual(old?.body, item.body);
  assert.deepEqual(
    (await repo.setBook.itemVersion("item_1", 1))?.body,
    item.body,
  );
  assert.deepEqual((await repo.setBook.itemVersion("item_1", 2))?.body, body);
  assert.equal(await repo.setBook.itemVersion("item_1", 3), null);
});

test("a stale edit is a conflict and files nothing", async () => {
  const repo = await make();
  assert.ok((await repo.setBook.editItem("item_1", { pos: 2 }, 1)).ok);
  const stale = await repo.setBook.editItem("item_1", { pos: 3 }, 1);
  assert.deepEqual(stale, { ok: false, conflict: true, current: 2 });
  assert.equal((await repo.setItemVersions.list()).length, 1);
  assert.deepEqual(await repo.setBook.editItem("item_9", {}, 1), {
    ok: false,
    conflict: true,
    current: null,
  });
});

test("a removed item leaves the set and keeps its versions", async () => {
  const repo = await make();
  await repo.setBook.editItem("item_1", { pos: 2 }, 1);
  assert.ok((await repo.setBook.removeItem("item_1", 2)).ok);
  assert.equal((await repo.setBook.read("set_1"))?.items.length, 0);
  assert.equal((await repo.setItemVersions.list()).length, 1);
});

test("migration 0008 copies own sets under prefixed ids, once, and a deleted item stays deleted", async () => {
  const db = migratedDb();
  db.exec(
    `INSERT INTO own_sets VALUES ('abc','Cardiac','question',NULL,NULL,5,2);
     INSERT INTO own_set_items VALUES ('abc','x1',1,'{"id":"x1","stem":"Q","type":"multi_select"}',6,3);
     INSERT INTO own_set_items VALUES ('abc','x2',2,'{"id":"x2","stem":"R"}',7,1);
     INSERT INTO deletions VALUES ('own_set_items','abc/x2',9);
     INSERT INTO own_attempts VALUES ('abc','x1','a1',8,'{}');`,
  );
  const sql = readFileSync(
    new URL("../migrations/0008_own_sets_backfill.sql", import.meta.url),
    "utf8",
  );
  db.exec(sql);
  db.exec(sql); // a second run adds nothing
  const repo = tablesRepo(sqliteD1(db), { clock: () => 1 });
  const r = await repo.setBook.read("set_abc");
  assert.equal(r?.set.title, "Cardiac");
  assert.deepEqual(
    r?.items.map((i) => [i.id, i.type, i.v, i.body]),
    [["item_x1", "multi_select", 3, { stem: "Q", type: "multi_select" }]],
  );
  const n = (t: string) =>
    (db.prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
  assert.equal(n("set_items"), 2);
  assert.equal(n("own_attempts"), 2);
  assert.equal(n("deletions"), 2);
});
