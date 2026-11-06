import test from "node:test";
import assert from "node:assert/strict";
import { gatherExcerpts } from "./excerpts.ts";
import { putNoteRow, sqliteD1 } from "./sqlite-d1.test.ts";

function seeded() {
  const db = sqliteD1();
  void db
    .prepare(
      "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
    )
    .run();
  void db
    .prepare(
      "CREATE TABLE deletions (c TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (c, id))",
    )
    .run();
  const put = (c: string, id: string, data: string) =>
    db
      .prepare("INSERT INTO docs (c, id, data, at, v) VALUES (?, ?, ?, 0, 1)")
      .bind(c, id, data)
      .run();
  const note = (id: string, title: string, text: string) =>
    putNoteRow(db, id, title, text);
  return { db, put, note };
}

test("passages come from Matt's notes that match the objectives, never from other collections", async () => {
  const { db, put, note } = seeded();
  await note(
    "n1",
    "Vitals",
    "Pulse is measured at the radial artery for one full minute.",
  );
  await note("n2", "Renal", "Kidneys filter blood and make urine.");
  await put("sets", "s1", JSON.stringify({ title: "Pulse set", items: [] }));
  // only a note's text column is searched: a pulse in a title or body alone is not a match
  await note("n3", "Pulse", "Kidneys again.");
  const got = await gatherExcerpts(db, ["Pulse measurement"]);
  assert.deepEqual(
    got.map((e) => e.id),
    ["n1"],
  );
  assert.match(got[0]!.text, /radial artery/);
});

test("no objectives, or no match, gathers nothing", async () => {
  const { db, note } = seeded();
  await note("n1", "Vitals", "Pulse is measured.");
  assert.deepEqual(await gatherExcerpts(db, []), []);
  assert.deepEqual(await gatherExcerpts(db, ["zebra"]), []);
});

test("a note in Recently deleted is never an excerpt", async () => {
  const { db, note } = seeded();
  await note("n1", "Vitals", "Pulse is measured at the wrist.");
  await note("n2", "Old", "Pulse pulse pulse pulse measurement.");
  await db
    .prepare("UPDATE notes SET deleted_at = 1 WHERE id = 'note_n2'")
    .run();
  const got = await gatherExcerpts(db, ["Pulse measurement"]);
  assert.deepEqual(
    got.map((e) => e.id),
    ["n1"],
  );
});

test("the best match survives more than 60 matches", async () => {
  const { db, note } = seeded();
  for (let i = 0; i < 70; i++)
    await note(
      `a${String(i).padStart(2, "0")}`,
      "Misc",
      `A pulse is mentioned in passing ${i}.`,
    );
  await note(
    "zbest",
    "Pulse measurement",
    "Pulse measurement: take the pulse at the radial artery.",
  );
  const got = await gatherExcerpts(db, ["Pulse measurement"]);
  assert.equal(got[0]!.id, "zbest");
});
