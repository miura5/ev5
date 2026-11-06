import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./matt-handlers-setup.test.ts";

test("editing an item keeps its rationale, objective, source and table", async () => {
  const { call, DB } = await setup();
  const set = (await call("set.create", { title: "Fluids" })).body.result.set
    .id as string;
  const q = "Which is normal sodium?\n- 100\n* 140\n- 180";
  const item = (await call("set.item_add", { set, text: q })).body.result.item
    .itemId as string;
  const row = await DB.prepare(
    "SELECT body FROM own_set_items WHERE item_id = ?",
  )
    .bind(item)
    .first<{ body: string }>();
  const extra = {
    ...JSON.parse(row!.body),
    rationales: ["a", "b", "c"],
    objective: "obj-1",
    sourceRef: { c: "notes", id: "n1" },
    matrix: { rows: ["r"], cols: ["c"] },
  };
  await DB.prepare("UPDATE own_set_items SET body = ? WHERE item_id = ?")
    .bind(JSON.stringify(extra), item)
    .run();
  const r = await call("set.item_update", {
    set,
    item,
    text: q.replace("140", "138"),
  });
  assert.equal(r.status, 200);
  const after = await DB.prepare(
    "SELECT body FROM own_set_items WHERE item_id = ?",
  )
    .bind(item)
    .first<{ body: string }>();
  const body = JSON.parse(after!.body);
  assert.equal(body.options[1], "138");
  assert.deepEqual(body.rationales, ["a", "b", "c"]);
  assert.equal(body.objective, "obj-1");
  assert.deepEqual(body.sourceRef, { c: "notes", id: "n1" });
  assert.deepEqual(body.matrix, { rows: ["r"], cols: ["c"] });
});
