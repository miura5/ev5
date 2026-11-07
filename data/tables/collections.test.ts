import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";
import { WriteRefused } from "./gate.ts";

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
const apply = (db: DatabaseSync, upTo: string) => {
  for (const f of files)
    if (f <= upTo) db.exec(readFileSync(new URL(f, dir), "utf8"));
};
const col = { title: "Cardio", pos: 1, parent_id: null as string | null };

test("collection rows: one level of nesting is checked on write", async () => {
  const db = new DatabaseSync(":memory:");
  apply(db, "9999");
  let now = 0;
  const r = tablesRepo(sqliteD1(db), { clock: () => (now += 1000) });
  assert.ok((await r.collectionRows.save({ id: "col_a", ...col }, null)).ok);
  assert.ok(
    (
      await r.collectionRows.save(
        { id: "col_b", ...col, parent_id: "col_a" },
        null,
      )
    ).ok,
  );
  await assert.rejects(
    r.collectionRows.save({ id: "col_c", ...col, parent_id: "col_b" }, null),
    WriteRefused,
  );
  await assert.rejects(
    r.collectionRows.save({ id: "col_d", ...col, parent_id: "col_zz" }, null),
    WriteRefused,
  );
  const a = (await r.collectionRows.list()).find((c) => c.id === "col_a")!;
  await assert.rejects(
    r.collectionRows.save({ id: "col_a", ...col, parent_id: "col_b" }, a.v),
    WriteRefused,
  );
  assert.equal((await r.collectionRows.list()).length, 2);
  assert.deepEqual(await r.collectionRows.save({ id: "col_b", ...col }, 9), {
    ok: false,
    conflict: true,
    current: 1,
  });
  assert.ok((await r.collectionRows.remove("col_b", 1)).ok);
  assert.equal((await r.collectionRows.list()).length, 1);
});

test("the pins repo fills the id and target_kind columns", async () => {
  const db = new DatabaseSync(":memory:");
  apply(db, "9999");
  const r = tablesRepo(sqliteD1(db), { clock: () => 5000 });
  await r.pins.set("notes", "n1", 1);
  await r.pins.set("sets", "s1", 2);
  const got = db
    .prepare("SELECT id, target_c, target_kind FROM pins ORDER BY pos")
    .all() as { id: string; target_c: string; target_kind: string }[];
  assert.deepEqual(
    got.map((g) => [g.target_c, g.target_kind]),
    [
      ["notes", "notes"],
      ["sets", "sets"],
    ],
  );
  assert.match(got[1]!.id, /^pin_[0-9a-f]{19}$/);
  assert.ok(await r.pins.remove("notes", "n1"));
  assert.deepEqual(
    (await r.pins.list()).map((x) => x.targetId),
    ["s1"],
  );
});
