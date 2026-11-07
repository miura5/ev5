import test from "node:test";
import assert from "node:assert/strict";
import { findPassages, gatherExcerpts } from "./excerpts.ts";
import { putNoteRow, sqliteD1 } from "./sqlite-d1.test.ts";

function seeded() {
  const db = sqliteD1();
  void db
    .prepare(
      "CREATE TABLE deletions (c TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (c, id))",
    )
    .run();
  const note = (id: string, title: string, text: string) =>
    putNoteRow(db, id, title, text);
  return { db, note };
}

const inCollection = (
  db: ReturnType<typeof sqliteD1>,
  id: string,
  col: string,
) =>
  db
    .prepare("UPDATE notes SET collection_id = ? WHERE id = ?")
    .bind(col, id)
    .run();

test("passages come from the user's notes that match the objectives, never from other collections", async () => {
  const { db, note } = seeded();
  await note(
    "note_n1",
    "Accounts",
    "Posting splits ledger entries into invoice lines in the journal.",
  );
  await note("note_n2", "Verbs", "Ser and ir share the same preterite forms.");
  // only a note's text column is searched: ledger in a title or body alone is not a match
  await note("note_n3", "Ledger", "Verbs again.");
  const got = await gatherExcerpts(db, ["Ledger breakdown"]);
  assert.deepEqual(
    got.map((e) => e.id),
    ["note_n1"],
  );
  assert.match(got[0]!.text, /invoice/);
});

test("no objectives, or no match, gathers nothing", async () => {
  const { db, note } = seeded();
  await note("note_n1", "Accounts", "Ledger is split.");
  assert.deepEqual(await gatherExcerpts(db, []), []);
  assert.deepEqual(await gatherExcerpts(db, ["zebra"]), []);
});

test("a note in Recently deleted is never an excerpt", async () => {
  const { db, note } = seeded();
  await note("note_n1", "Accounts", "Ledger is split in the journal.");
  await note("note_n2", "Old", "Ledger ledger ledger ledger breakdown.");
  await db
    .prepare("UPDATE notes SET deleted_at = 1 WHERE id = 'note_n2'")
    .run();
  const got = await gatherExcerpts(db, ["Ledger breakdown"]);
  assert.deepEqual(
    got.map((e) => e.id),
    ["note_n1"],
  );
});

test("the best match survives more than 60 matches", async () => {
  const { db, note } = seeded();
  for (let i = 0; i < 70; i++)
    await note(
      `note_a${String(i).padStart(2, "0")}`,
      "Misc",
      `Ledger is mentioned in passing ${i}.`,
    );
  await note(
    "note_zbest",
    "Ledger breakdown",
    "Ledger breakdown: posting splits ledger entries into invoice lines.",
  );
  const got = await gatherExcerpts(db, ["Ledger breakdown"]);
  assert.equal(got[0]!.id, "note_zbest");
});

test("a set scoped to a collection draws only that collection's notes, with or without objectives", async () => {
  const { db, note } = seeded();
  await note("note_es1", "Preterite", "The preterite tells a finished action.");
  await note("note_es2", "Ser and ir", "Ser and ir share the same preterite forms.");
  await note("note_alt", "Accounts", "The preterite of ledger is not a thing.");
  await note("note_gone", "Old verbs", "Preterite preterite preterite.");
  for (const id of ["note_es1", "note_es2", "note_gone"])
    await inCollection(db, id, "col_spanish");
  await inCollection(db, "note_alt", "col_alpha");
  await db
    .prepare("UPDATE notes SET deleted_at = 1 WHERE id = 'note_gone'")
    .run();
  const spanish = { kind: "collection", id: "col_spanish" } as const;
  const ranked = await gatherExcerpts(db, ["ser ir forms"], spanish);
  assert.equal(ranked[0]!.id, "note_es2");
  assert.ok(ranked.every((e) => e.id === "note_es1" || e.id === "note_es2"));
  // no objectives, or none that match: the collection's passages are enough
  for (const objectives of [[], ["zebra"]]) {
    const got = await gatherExcerpts(db, objectives, spanish);
    assert.deepEqual(got.map((e) => e.id).sort(), ["note_es1", "note_es2"]);
  }
});

test("a set scoped to a note draws only that note", async () => {
  const { db, note } = seeded();
  await note(
    "note_n1",
    "STAR answers",
    "Answer with situation, task, action, result.",
  );
  await note("note_n2", "Questions", "Ask the interviewer about the team.");
  const got = await gatherExcerpts(db, [], { kind: "note", id: "note_n1" });
  assert.deepEqual(
    got.map((e) => e.id),
    ["note_n1"],
  );
  assert.deepEqual(
    await gatherExcerpts(db, [], { kind: "note", id: "missing" }),
    [],
  );
});

test("set passages are the stems of live set items on the tables, and a deleted set or item is not one", async () => {
  const { db } = seeded();
  const set = (id: string, title: string, deleted: number | null) =>
    db
      .prepare(
        "INSERT INTO sets (id, kind, title, created_by, at, deleted_at) VALUES (?, 'job', ?, 'worker', 1, ?)",
      )
      .bind(id, title, deleted)
      .run();
  const item = (
    id: string,
    setId: string,
    pos: number,
    stem: string,
    deleted: number | null = null,
  ) =>
    db
      .prepare(
        "INSERT INTO set_items (id, set_id, pos, type, body, at, deleted_at) VALUES (?, ?, ?, 'single', ?, 1, ?)",
      )
      .bind(id, setId, pos, JSON.stringify({ stem }), deleted)
      .run();
  await set("set_a", "Ledger set", null);
  await item("item_a1", "set_a", 1, "Which account holds the deposit?");
  await item("item_a2", "set_a", 2, "Posting splits ledger into what?");
  await item("item_a3", "set_a", 3, "Ledger removed question zebra.", 5);
  await set("set_b", "Old set", 9);
  await item("item_b1", "set_b", 1, "Posting of ledger in a deleted set.");
  const got = await findPassages(db, "ledger posting", ["sets"], 10);
  assert.deepEqual([...new Set(got.map((h) => h.id))], ["set_a"]);
  assert.ok(got.every((h) => !/zebra|deleted set/.test(h.text)));
  assert.deepEqual(await findPassages(db, "ledger", ["notes"], 10), []);
});
