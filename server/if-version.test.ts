import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./matt-handlers-setup.test.ts";

// §data.protocol: a command that names the version the client last saw is refused with 409 when it is stale,
// and runs when it is current. Each test bumps the row to v2 first, so v1 is stale.

async function aSet() {
  const s = await setup();
  const set = (await s.call("set.create", { title: "Fluids" })).body.result.set
    .id as string;
  await s.call("set.update", { id: set, title: "Fluids 2" }); // v2
  return { ...s, set };
}

test("set.update: a stale if_version is 409 and writes nothing", async () => {
  const { call, set } = await aSet();
  assert.equal(
    (await call("set.update", { id: set, title: "Late", if_version: 1 })).status,
    409,
  );
  const ok = await call("set.update", { id: set, title: "Now", if_version: 2 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.result.set.title, "Now");
});

test("item.rename: stale 409 on a set, current runs", async () => {
  const { call, set } = await aSet();
  assert.equal(
    (await call("item.rename", { id: set, title: "Late", if_version: 1 })).status,
    409,
  );
  assert.equal(
    (await call("item.rename", { id: set, title: "Now", if_version: 2 })).status,
    200,
  );
});

test("item.rename: stale 409 on a collection", async () => {
  const { call } = await setup();
  const id = (await call("collection.create", { title: "A" })).body.result
    .collection.id as string;
  await call("item.rename", { id, title: "B" }); // v2
  assert.equal(
    (await call("item.rename", { id, title: "C", if_version: 1 })).status,
    409,
  );
  assert.equal(
    (await call("item.rename", { id, title: "C", if_version: 2 })).status,
    200,
  );
});

test("item.move: stale 409 on a set, current runs", async () => {
  const { call, set } = await aSet();
  const col = (await call("collection.create", { title: "BIO" })).body.result
    .collection.id as string;
  assert.equal(
    (await call("item.move", { id: set, collection: col, if_version: 1 })).status,
    409,
  );
  assert.equal(
    (await call("item.move", { id: set, collection: col, if_version: 2 })).status,
    200,
  );
});

test("set.item_update: a stale if_version is 409", async () => {
  const { call, set } = await aSet();
  const q = "Which is normal sodium?\n- 100\n* 140\n- 180";
  const item = (await call("set.item_add", { set, text: q })).body.result.item
    .itemId as string;
  await call("set.item_update", { set, item, text: q.replace("140", "138") }); // v2
  const text = q.replace("140", "139");
  assert.equal(
    (await call("set.item_update", { set, item, text, if_version: 1 })).status,
    409,
  );
  assert.equal(
    (await call("set.item_update", { set, item, text, if_version: 2 })).status,
    200,
  );
});

test("note.move: a stale if_version is 409", async () => {
  const { call } = await setup();
  const col = (await call("collection.create", { title: "BIO" })).body.result
    .collection.id as string;
  const id = (await call("note.create", {})).body.result.id as string;
  await call("note.save", { id, body: "a" }); // v2
  assert.equal(
    (await call("note.move", { id, collection: col, if_version: 1 })).status,
    409,
  );
  assert.equal(
    (await call("note.move", { id, collection: col, if_version: 2 })).status,
    200,
  );
});

test("date.update: a stale if_version is 409", async () => {
  const { call } = await setup();
  const id = (await call("date.create", { title: "Quiz", date: "2026-11-20" }))
    .body.result.id as string;
  await call("date.update", { id, title: "Quiz 2" }); // v2
  assert.equal(
    (await call("date.update", { id, title: "Late", if_version: 1 })).status,
    409,
  );
  assert.equal(
    (await call("date.update", { id, title: "Now", if_version: 2 })).status,
    200,
  );
});
