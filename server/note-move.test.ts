import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./matt-handlers-setup.test.ts";

test("item.move puts a note in a collection on its own row, with no memberships row", async () => {
  const { call, DB } = await setup();
  const cid = (await call("collection.create", { title: "BIO" })).body.result
    .collection.id as string;
  const id = (await call("note.create", {})).body.result.id as string;
  const mv = await call("item.move", { id, collection: cid, if_version: 1 });
  assert.equal(mv.status, 200);
  assert.deepEqual(mv.body.result.note, { id, collectionId: cid });
  assert.equal(
    (
      await DB.prepare("SELECT collection_id FROM notes WHERE id = ?")
        .bind(`note_${id}`)
        .first<{ collection_id: string }>()
    )?.collection_id,
    cid,
  );
  assert.equal(
    (await DB.prepare("SELECT 1 FROM memberships WHERE item_c = 'notes'").all())
      .results.length,
    0,
  );
});
