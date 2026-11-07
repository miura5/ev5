import test from "node:test";
import assert from "node:assert/strict";
import { findPassages, gatherExcerpts } from "./excerpts.ts";
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

const inCollection = (
  db: ReturnType<typeof sqliteD1>,
  id: string,
  col: string,
) =>
  db
    .prepare("UPDATE notes SET collection_id = ? WHERE id = ?")
    .bind(col, `note_${id}`)
    .run();

test("passages come from the user's notes that match the objectives, never from other collections", async () => {
  const { db, put, note } = seeded();
  await note(
    "n1",
    "Cells",
    "Glycolysis splits glucose into pyruvate in the cytoplasm.",
  );
  await note("n2", "Verbs", "Ser and ir share the same preterite forms.");
  await put("sets", "s1", JSON.stringify({ title: "Glucose set", items: [] }));
  // only a note's text column is searched: glucose in a title or body alone is not a match
  await note("n3", "Glucose", "Verbs again.");
  const got = await gatherExcerpts(db, ["Glucose breakdown"]);
  assert.deepEqual(
    got.map((e) => e.id),
    ["n1"],
  );
  assert.match(got[0]!.text, /pyruvate/);
});

test("no objectives, or no match, gathers nothing", async () => {
  const { db, note } = seeded();
  await note("n1", "Cells", "Glucose is split.");
  assert.deepEqual(await gatherExcerpts(db, []), []);
  assert.deepEqual(await gatherExcerpts(db, ["zebra"]), []);
});

test("a note in Recently deleted is never an excerpt", async () => {
  const { db, note } = seeded();
  await note("n1", "Cells", "Glucose is split in the cytoplasm.");
  await note("n2", "Old", "Glucose glucose glucose glucose breakdown.");
  await db
    .prepare("UPDATE notes SET deleted_at = 1 WHERE id = 'note_n2'")
    .run();
  const got = await gatherExcerpts(db, ["Glucose breakdown"]);
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
      `Glucose is mentioned in passing ${i}.`,
    );
  await note(
    "zbest",
    "Glucose breakdown",
    "Glucose breakdown: glycolysis splits glucose into pyruvate.",
  );
  const got = await gatherExcerpts(db, ["Glucose breakdown"]);
  assert.equal(got[0]!.id, "zbest");
});

test("a set scoped to a collection draws only that collection's notes, with or without objectives", async () => {
  const { db, note } = seeded();
  await note("es1", "Preterite", "The preterite tells a finished action.");
  await note("es2", "Ser and ir", "Ser and ir share the same preterite forms.");
  await note("bio", "Cells", "The preterite of glucose is not a thing.");
  await note("gone", "Old verbs", "Preterite preterite preterite.");
  for (const id of ["es1", "es2", "gone"])
    await inCollection(db, id, "col_spanish");
  await inCollection(db, "bio", "col_biology");
  await db
    .prepare("UPDATE notes SET deleted_at = 1 WHERE id = 'note_gone'")
    .run();
  const spanish = { kind: "collection", id: "col_spanish" } as const;
  const ranked = await gatherExcerpts(db, ["ser ir forms"], spanish);
  assert.equal(ranked[0]!.id, "es2");
  assert.ok(ranked.every((e) => e.id === "es1" || e.id === "es2"));
  // no objectives, or none that match: the collection's passages are enough
  for (const objectives of [[], ["zebra"]]) {
    const got = await gatherExcerpts(db, objectives, spanish);
    assert.deepEqual(got.map((e) => e.id).sort(), ["es1", "es2"]);
  }
});

test("a set scoped to a note draws only that note", async () => {
  const { db, note } = seeded();
  await note(
    "n1",
    "STAR answers",
    "Answer with situation, task, action, result.",
  );
  await note("n2", "Questions", "Ask the interviewer about the team.");
  const got = await gatherExcerpts(db, [], { kind: "note", id: "n1" });
  assert.deepEqual(
    got.map((e) => e.id),
    ["n1"],
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
  await set("set_a", "Glucose set", null);
  await item("item_a1", "set_a", 1, "Which organ makes insulin?");
  await item("item_a2", "set_a", 2, "Glycolysis splits glucose into what?");
  await item("item_a3", "set_a", 3, "Glucose removed question zebra.", 5);
  await set("set_b", "Old set", 9);
  await item("item_b1", "set_b", 1, "Glycolysis of glucose in a deleted set.");
  const got = await findPassages(db, "glucose glycolysis", ["sets"], 10);
  assert.deepEqual([...new Set(got.map((h) => h.id))], ["set_a"]);
  assert.ok(got.every((h) => !/zebra|deleted set/.test(h.text)));
  assert.deepEqual(await findPassages(db, "glucose", ["notes"], 10), []);
});
