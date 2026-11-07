import test from "node:test";
import assert from "node:assert/strict";
import { newNoteId } from "../domain/index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

// One note id form end to end (§data.tables): the editor makes a new note's id with newNoteId and a random UUID
// (areas/notes/useNotes.ts), and note.save checks it with the same domain rule, so the two cannot drift apart.

test("a note id made the way the editor makes one saves as a new note", async () => {
  const { call, note } = await setup();
  const id = newNoteId(new Date().toISOString(), crypto.randomUUID());
  const r = await call("note.save", { id, body: "first words", if_version: 0 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(await note(id));
});

test("note.save refuses an id in another form, such as the old n- form", async () => {
  const { call } = await setup();
  for (const id of ["n-20261107-180822-abcdef123456", "note_1"]) {
    const r = await call("note.save", { id, body: "x", if_version: 0 });
    assert.equal(r.status, 400, id);
  }
});
