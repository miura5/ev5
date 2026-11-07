import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";

const sql = readFileSync(
  new URL("../migrations/0014_weak_spots_backfill.sql", import.meta.url),
  "utf8",
);

test("migration 0014 copies weakspots documents into rows and events into appended rows, and runs once", async () => {
  const db = migratedDb();
  const put = (id: string, d: object) =>
    db
      .prepare(
        "INSERT INTO docs (c, id, data, at, v) VALUES ('weakspots', ?, ?, 7, 3)",
      )
      .run(id, JSON.stringify(d));
  db.exec(
    "INSERT INTO collections (id, title, at, v) VALUES ('col_a', 'Course A', 1, 1)",
  );
  put("w1", {
    schema: 2,
    writer: "page",
    at: "2026-10-18T15:00:00.000Z",
    source: "quiz",
    topic: "Fluids",
    objective: "o-1",
    kind: "concept",
    course: "course a",
    initial: { streak: 2 },
    preRead: true,
    events: {
      "page-20261018-150000-abc": {
        type: "seen",
        by: "owner",
        at: "2026-10-18T15:00:00.000Z",
      },
      "page-20261018-151500-def": { type: "decline", by: "ev4" },
      "page-20261018-152000-ghi": { type: "snooze" },
      "page-20261018-153000-jkl": {
        type: "nonsense",
        at: "2026-10-18T15:30:00.000Z",
      },
    },
  });
  put("w2", { topic: "x", kind: "concept", source: "s", objective: "" });
  put("w3", { topic: "bad", kind: "weird", source: "s", objective: "" });
  put("wgone", { topic: "g", kind: "note", source: "s", objective: "" });
  db.exec("INSERT INTO deletions VALUES ('weakspots','wgone',9)");
  db.exec(sql);
  db.exec(sql); // a second run adds nothing
  const t = tablesRepo(sqliteD1(db), { clock: () => 1 });
  const spots = await t.weakSpots.list();
  assert.deepEqual(
    spots.map((s) => s.id),
    ["ws_w1", "ws_w2"],
  );
  const w1 = spots[0]!;
  assert.equal(w1.collection_id, "col_a");
  assert.equal(w1.objective_id, "o-1");
  assert.equal(w1.pre_read, 1);
  assert.equal(w1.created_by, "user");
  assert.equal(w1.v, 3);
  const ev = (await t.weakSpotEvents.list()).map((e) => [
    e.id,
    e.type,
    e.by,
    e.at,
  ]);
  assert.deepEqual(ev, [
    [
      "wse_w1:page-20261018-150000-abc",
      "seen",
      "user",
      Date.parse("2026-10-18T15:00:00.000Z"),
    ],
    [
      "wse_w1:page-20261018-151500-def",
      "decline",
      "ev",
      Date.parse("2026-10-18T15:15:00.000Z"),
    ],
  ]);
  const n = (q: string) => (db.prepare(q).get() as { n: number }).n;
  assert.equal(n("SELECT count(*) AS n FROM docs WHERE c = 'weakspots'"), 4);
});
