import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { newNoteRow, noteDocOf, parseNote } from "../../domain/index.ts";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";

const sql = readFileSync(
  new URL("../migrations/0013_notes_backfill.sql", import.meta.url),
  "utf8",
);

const note = (extra: object = {}) => ({
  schema: 1,
  writer: "page",
  at: "2026-10-18T15:00:00.000Z",
  source: "E.V. Home",
  createdAt: "2026-10-17T09:00:00.000Z",
  title: "Fluids",
  course: "Biology 101",
  editedAt: "2026-10-18T15:00:00.000Z",
  blocks: [
    { type: "h1", runs: [{ text: "Fluids" }] },
    { type: "p", runs: [{ text: "Sodium is " }, { text: "135", b: true }] },
    { type: "p", runs: [] },
  ],
  ...extra,
});

test("migration 0013 copies note documents into rows with their words, collection and deletion, and runs once", async () => {
  const db = migratedDb();
  const put = (id: string, d: unknown) =>
    db
      .prepare(
        "INSERT INTO docs (c, id, data, at, v) VALUES ('notes', ?, ?, 7, 3)",
      )
      .run(id, typeof d === "string" ? d : JSON.stringify(d));
  put("n-a", note({ label: "week 4", archivedAt: "2026-10-19T00:00:00.000Z" }));
  put("n-b", note({ title: "Fluids (earlier)", earlierOf: "n-a" }));
  put("n-gone", note());
  put("n-bad", "not json");
  put("n-notitle", { blocks: [] });
  db.exec("INSERT INTO deletions VALUES ('notes','n-gone',9)");
  db.exec(
    "INSERT INTO memberships (item_c, item_id, collection_id, at, v) VALUES ('notes','n-a','col_x',1,1)",
  );
  db.exec(sql);
  db.exec(sql); // a second run adds nothing
  const t = tablesRepo(sqliteD1(db), { clock: () => 1 });
  const a = await t.noteBook.get("note_n-a");
  assert.ok(a);
  assert.equal(a.v, 3);
  assert.equal(a.collection_id, "col_x");
  assert.equal(a.text, "Fluids\nSodium is 135\n");
  // the document reads back with its blocks and marks; the old fields (course, label, archivedAt) are not read (§data.notes)
  const { course: _c, ...plain } = note();
  assert.deepEqual(
    { ...noteDocOf(a), at: "x" },
    { ...parseNote(plain), at: "x" },
  );
  assert.equal((await t.noteBook.get("note_n-b"))?.earlier_of, "note_n-a");
  assert.equal(await t.noteBook.get("note_n-gone"), null); // deleted stays deleted
  assert.equal(await t.noteBook.get("note_n-bad"), null);
  assert.equal(await t.noteBook.get("note_n-notitle"), null);
  const n = (q: string) => (db.prepare(q).get() as { n: number }).n;
  assert.equal(n("SELECT count(*) AS n FROM notes"), 3);
  assert.equal(n("SELECT count(*) AS n FROM docs WHERE c = 'notes'"), 5);
  // the search column finds the words and not a deleted note
  assert.deepEqual(
    (await t.noteBook.search(["%sodium%"])).map((h) => h.id),
    ["note_n-a", "note_n-b"],
  );
});

test("the gate refuses a note that is too big or not a note, and a stale change is a conflict", async () => {
  const db = migratedDb();
  const t = tablesRepo(sqliteD1(db), { clock: () => 5 });
  const row = newNoteRow("n-z", parseNote(note()), null);
  const made = await t.noteBook.create(row);
  assert.ok(made.ok);
  assert.equal((await t.noteBook.create(row)).ok, false); // a repeated id
  const changed = await t.noteBook.change({ ...row, title: "New" }, 1);
  assert.ok(changed.ok);
  assert.equal(
    (await t.noteBook.change({ ...row, title: "Stale" }, 1)).ok,
    false,
  );
  await assert.rejects(
    t.noteBook.create({ ...row, id: "bad_n-z" }),
    /does not parse/,
  );
  await assert.rejects(
    t.noteBook.create({
      ...row,
      id: "note_n-big",
      body: { x: "y".repeat(300000) },
    }),
    /at most/,
  );
});
