import test from "node:test";
import assert from "node:assert/strict";
import { tablesRepo } from "../data/index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

test("a note is made, saved and moved", async () => {
  const { call, doc } = await setup();
  const col = await call("collection.create", { title: "BIO" });
  const cid = col.body.result.collection.id as string;
  const made = await call("note.create", { collection: cid });
  assert.equal(made.status, 200);
  const id = made.body.result.id as string;
  assert.ok(await doc("notes", id));
  const saved = await call("note.save", {
    id,
    body: "Fluids\nSodium is 135-145",
  });
  assert.equal(saved.status, 200);
  const after = await doc("notes", id);
  assert.equal(after?.blocks.length, 2);
  const col2 = await call("collection.create", { title: "NUR" });
  const moved = await call("note.move", {
    id,
    collection: col2.body.result.collection.id,
  });
  assert.equal(moved.status, 200);
  assert.equal(
    (await call("note.save", { id: "n-nope", body: "x" })).status,
    404,
  );
  assert.equal(
    (await call("note.move", { id, collection: "nope" })).status,
    404,
  );
  // blocks sent as JSON are kept
  const j = await call("note.save", {
    id,
    body: JSON.stringify([{ type: "h1", runs: [{ text: "Heart" }] }]),
  });
  assert.equal(j.status, 200);
  assert.equal((await doc("notes", id))?.title, "Heart");
});

test("new here makes a note, a set, a date and a collection", async () => {
  const { call, DB } = await setup();
  const cid = (await call("collection.create", { title: "BIO" })).body.result
    .collection.id as string;
  for (const kind of ["note", "set", "date", "collection"])
    assert.equal(
      (await call("collection.new_here", { collection: cid, kind })).status,
      200,
      kind,
    );
  assert.equal(
    (await call("collection.new_here", { collection: "x", kind: "note" }))
      .status,
    404,
  );
  const m = await DB.prepare(
    "SELECT item_c FROM memberships ORDER BY item_c",
  ).all<{ item_c: string }>();
  assert.deepEqual(
    m.results.map((r) => r.item_c),
    ["notes", "sets"],
  );
});

test("a session starts, pauses, answers a check, and ends", async () => {
  const { call, doc, DB } = await setup();
  const a = (await call("session.start", { noteId: "n-1" })).body.result
    .id as string;
  const s1 = await doc("sessions", a);
  assert.equal(s1?.noteId, "n-1");
  const p = await call("session.pause", { id: a });
  assert.equal(p.body.result.paused, true);
  assert.equal(
    (await call("session.pause", { id: a })).body.result.paused,
    false,
  );
  assert.equal(
    (await call("check.answer", { id: a, answer: "Na is 135-145" })).status,
    200,
  );
  assert.equal((await call("check.just_tell_me", { id: a })).status, 200);
  assert.ok(await doc("sessions", a));
  // a second session ends the first
  const b = (await call("session.start", {})).body.result.id as string;
  assert.equal((await doc("sessions", a))?.status, "ended");
  assert.equal((await call("session.end", { id: b })).status, 200);
  assert.equal((await call("session.end", { id: b })).status, 409);
  assert.equal((await call("session.pause", { id: "nope" })).status, 404);
  const talk = await DB.prepare("SELECT id FROM docs WHERE c = 'talk'").first<{
    id: string;
  }>();
});

test("a weak spot is confirmed, declined, learned; a spot that is not proposed cannot be confirmed", async () => {
  const { call, DB } = await setup();
  const t = tablesRepo(DB as never, { clock: () => 1000 });
  const base = {
    collection_id: null,
    objective_id: null,
    topic: "Sodium",
    kind: "concept",
    words: null,
    source_line: "E.V. Home",
    duplicate_of: null,
    created_by: "ev",
    pre_read: 0,
    reading_due: null,
  } as const;
  await t.weakSpots.save({ ...base, id: "ws_1", proposed: 1 }, null);
  await t.weakSpots.save({ ...base, id: "ws_2", proposed: 1 }, null);
  await t.weakSpots.save({ ...base, id: "ws_3", proposed: 0 }, null);
  assert.equal((await call("weakspot.confirm", { id: "ws_1" })).status, 200);
  assert.equal((await call("weakspot.decline", { id: "ws_2" })).status, 200);
  assert.equal((await call("weakspot.confirm", { id: "ws_3" })).status, 409);
  assert.equal(
    (await call("weakspot.mark_learned", { id: "ws_3" })).status,
    200,
  );
  assert.equal(
    (await call("weakspot.mark_learned", { id: "ws_3" })).status,
    200,
  );
  assert.equal(
    (await call("weakspot.drill", { id: "ws_3" })).body.result.client,
    true,
  );
  assert.equal((await call("weakspot.drill", { id: "zz" })).status, 404);
  assert.equal((await call("weakspot.mark_learned", { id: "zz" })).status, 404);
  const types = async (id: string) =>
    (await t.weakSpotEvents.list({ where: { weak_spot_id: id } })).map(
      (e) => `${e.type}/${e.by}`,
    );
  assert.deepEqual(await types("ws_1"), ["accept/user"]);
  assert.deepEqual(await types("ws_2"), ["decline/user"]);
  // two quick taps are two appended rows, never a conflict
  assert.deepEqual(await types("ws_3"), ["solid/user", "solid/user"]);
});

test("ask just tell me is logged in today's talk document", async () => {
  const { call, DB, doc } = await setup();
  assert.equal((await call("ask.just_tell_me", { id: "m-1" })).status, 200);
  assert.equal((await call("ask.just_tell_me", { id: "m-2" })).status, 200);
  const r = await DB.prepare("SELECT id FROM docs WHERE c = 'talk'").all<{
    id: string;
  }>();
  assert.equal(r.results.length, 1);
  const t = await doc("talk", (r.results[0] as { id: string }).id);
  assert.equal(Object.keys(t?.messages).length, 2);
});
