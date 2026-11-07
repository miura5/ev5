import { test } from "vitest";
import assert from "node:assert/strict";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";
import { WriteRefused } from "./gate.ts";
import type { Fields } from "./kinds.ts";
import type { SetItemRow } from "../../domain/index.ts";

const set = {
  id: "set_1",
  collection_id: null,
  kind: "drill",
  title: "Cycles",
  source_kind: null,
  source_id: null,
  created_by: "user",
  job_id: null,
  focus: null,
  asked: null,
} as const;
const item: Fields<SetItemRow> = {
  id: "item_1",
  set_id: "set_1",
  pos: 1,
  type: "single",
  body: { stem: "Which first?", options: ["a", "b"], correct: [0] },
  objective_id: null,
  weak_spot_id: null,
  source_ref: null,
};

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
