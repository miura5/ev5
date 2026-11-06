import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionDoc } from "../../domain/index.ts";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";

const sql = readFileSync(
  new URL("../migrations/0012_sessions_backfill.sql", import.meta.url),
  "utf8",
);

test("migration 0012 copies session documents into rows and events into appended rows, and runs once", async () => {
  const db = migratedDb();
  const put = (id: string, d: object) =>
    db
      .prepare(
        "INSERT INTO docs (c, id, data, at, v) VALUES ('sessions', ?, ?, 7, 3)",
      )
      .run(id, JSON.stringify(d));
  put("ss-a", {
    schema: 2,
    date: "2026-10-18",
    status: "ended",
    noteId: "n-1",
    planned: 25,
    topic: "Fluids",
    startedAt: "2026-10-18T15:00:00.000Z",
    endedAt: "2026-10-18T15:30:00.000Z",
    minutes: 29.6,
    driver: { view: "notes", at: "2026-10-18T15:01:00.000Z" },
    events: {
      "page-20261018-150000-abc": {
        type: "start",
        at: "2026-10-18T15:00:00.000Z",
      },
      // no `at`: the time in the key is used
      "page-20261018-151500-def": { type: "answer", n: 1, msgId: "m-1" },
      "page-20261018-153000-ghi": {
        type: "nonsense",
        at: "2026-10-18T15:30:00.000Z",
      },
    },
  });
  put("ss-skill", { date: "2026-10-18", kind: "skill", events: {} });
  put("ss-gone", { date: "2026-10-19" });
  db.exec("INSERT INTO deletions VALUES ('sessions','ss-gone',9)");
  db.exec(sql);
  db.exec(sql); // a second run adds nothing
  const t = tablesRepo(sqliteD1(db), { clock: () => 1 });
  const s = await t.sessionBook.get("ses_ss-a");
  assert.ok(s);
  assert.equal(s.row.v, 3);
  assert.equal(s.row.minutes, 30);
  assert.equal(s.row.started_at, Date.parse("2026-10-18T15:00:00.000Z"));
  assert.deepEqual(s.row.driver, {
    view: "notes",
    at: Date.parse("2026-10-18T15:01:00.000Z"),
  });
  assert.deepEqual(
    s.events.map((e) => [e.id, e.type, e.at, e.body]),
    [
      [
        "sese_ss-a:page-20261018-150000-abc",
        "start",
        Date.parse("2026-10-18T15:00:00.000Z"),
        null,
      ],
      [
        "sese_ss-a:page-20261018-151500-def",
        "answer",
        Date.parse("2026-10-18T15:15:00.000Z"),
        { n: 1, msgId: "m-1" },
      ],
    ],
  );
  // The document the page reads has the events under their own keys.
  const doc = sessionDoc(s.row, s.events);
  assert.deepEqual(Object.keys(doc.events ?? {}), [
    "page-20261018-150000-abc",
    "page-20261018-151500-def",
  ]);
  assert.equal(await t.sessionBook.get("ses_ss-skill"), null);
  assert.equal(await t.sessionBook.get("ses_ss-gone"), null); // deleted stays deleted
  const n = (q: string) => (db.prepare(q).get() as { n: number }).n;
  assert.equal(n("SELECT count(*) AS n FROM sessions"), 2);
  assert.equal(n("SELECT count(*) AS n FROM session_events"), 2);
  assert.equal(n("SELECT count(*) AS n FROM docs WHERE c = 'sessions'"), 3);
});
