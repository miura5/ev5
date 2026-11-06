import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { commands } from "../commands/index.ts";
import { commandHandlers } from "./command-handlers.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup() {
  const DB = sqliteD1();
  for (const f of [
    "0000_baseline",
    "0001_deletions",
    "0002_jobs_ceilings",
    "0003_collections_pins_own",
    "0004_ceiling_usage",
    "0006_tables",
  ])
    for (const stmt of readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    )
      .replace(/--.*$/gm, "")
      .split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const call = async (name: string, input: unknown) => {
    const r = await app.request(
      `/api/v1/commands/${name}`,
      {
        method: "POST",
        headers: { authorization: "Bearer app-t" },
        body: JSON.stringify({ input }),
      },
      env,
    );
    return { status: r.status, body: (await r.json()) as Record<string, any> };
  };
  const doc = async (c: string, id: string) => {
    const r = await DB.prepare("SELECT data FROM docs WHERE c = ? AND id = ?")
      .bind(c, id)
      .first<{ data: string }>();
    return r ? (JSON.parse(r.data) as Record<string, any>) : null;
  };
  const put = (c: string, id: string, data: object) =>
    DB.prepare("INSERT INTO docs (c, id, data, at, v) VALUES (?, ?, ?, 1, 1)")
      .bind(c, id, JSON.stringify(data))
      .run();
  return { DB, call, doc, put };
}
test("a date is added and changed through an override", async () => {
  const { call, doc } = await setup();
  const made = await call("date.create", {
    title: "Skills check",
    date: "2026-11-20",
  });
  assert.equal(made.status, 200);
  const { id } = made.body.result;
  assert.equal((await doc("dates", id))?.addedBy, "Matt");
  assert.equal(
    (
      await call("date.update", {
        id,
        title: "Skills validation",
        date: "2026-11-21",
      })
    ).status,
    200,
  );
  assert.deepEqual((await doc("dateedits", id))?.overrides, {
    date: "2026-11-21",
    title: "Skills validation",
  });
  assert.equal((await doc("dates", id))?.date, "2026-11-20"); // the entry itself is not rewritten
  assert.equal(
    (await call("date.update", { id: "none", title: "x" })).status,
    404,
  );
  assert.equal(
    (await call("date.update", { id, date: "2026-02-30" })).status,
    400,
  );
  assert.equal(
    (await call("date.create", { title: "x", date: "soon" })).status,
    400,
  );
});

test("approving a study plan puts it in force and putting it away retires it", async () => {
  const { call, doc, put } = await setup();
  await put("plans", "p1", {
    schema: 1,
    writer: "worker",
    at: "2026-11-01T00:00:00.000Z",
    source: "t",
    exam: "e1",
  });
  assert.equal((await call("studyplan.approve", { id: "p1" })).status, 200);
  assert.equal((await doc("planedits", "e1"))?.plan, "p1");
  assert.equal((await call("studyplan.put_away", { id: "p1" })).status, 200);
  const edits = await doc("planedits", "e1");
  assert.equal(edits?.plan, undefined);
  assert.ok(edits?.retired.p1.at);
  assert.equal((await call("studyplan.approve", { id: "p1" })).status, 200); // back in force, no longer retired
  assert.equal((await doc("planedits", "e1"))?.retired, undefined);
  assert.equal((await call("studyplan.approve", { id: "nope" })).status, 404);
  assert.equal((await doc("plans", "p1"))?.exam, "e1"); // the plan itself is untouched
});

test("approving a plan whose days have all passed is refused with a plain reason", async () => {
  const { call, doc, put } = await setup();
  const day = (date: string) => ({ date, tasks: [{ id: "t", text: "x" }] });
  const base = {
    schema: 1,
    writer: "worker",
    at: "2026-11-01T00:00:00.000Z",
    source: "t",
    exam: "e1",
  };
  await put("plans", "old", {
    ...base,
    days: [day("2000-01-01"), day("2000-01-02")],
  });
  await put("plans", "live", {
    ...base,
    days: [day("2000-01-01"), day("2999-01-01")],
  });
  const r = await call("studyplan.approve", { id: "old" });
  assert.equal(r.status, 409);
  assert.match(
    JSON.stringify(r.body),
    /days have all passed.*Plan again/,
  );
  assert.equal(await doc("planedits", "e1"), null);
  assert.equal((await call("studyplan.approve", { id: "live" })).status, 200);
});

test("a draft is kept into its set exactly once, or dropped; the whole set at once", async () => {
  const { DB, call, put } = await setup();
  const draft = (id: string, set: string, kind = "set-item") =>
    DB.prepare(
      "INSERT INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v) VALUES (?, 'j', ?, 'own_sets', ?, ?, 'pending', 1, 1)",
    )
      .bind(id, kind, set, JSON.stringify({ q: id }))
      .run();
  await put("sets", "s1", { title: "S" });
  for (const id of ["d1", "d2", "d3", "d4"]) await draft(id, "s1");
  await draft("sg", "s1", "suggestion");
  const state = async (id: string) =>
    (
      await DB.prepare("SELECT state FROM drafts WHERE id = ?")
        .bind(id)
        .first<{ state: string }>()
    )?.state;
  const items = async () =>
    (
      await DB.prepare(
        "SELECT id AS item_id, pos FROM set_items WHERE set_id = 'set_s1' ORDER BY pos",
      ).all<any>()
    ).results.map((r: any) => ({ ...r }));
  assert.equal((await call("draft.keep", { id: "d1" })).status, 200);
  assert.equal((await call("draft.keep", { id: "d1" })).status, 404); // kept once
  assert.equal((await call("draft.drop", { id: "d2" })).status, 200);
  assert.equal((await call("draft.keep", { id: "sg" })).status, 404); // a Suggestion is not a draft
  assert.deepEqual(await items(), [{ item_id: "item_d1", pos: 0 }]);
  assert.equal(
    (await call("draft.keep_all", { set: "s1" })).body.result.kept,
    2,
  );
  assert.deepEqual(
    (await items()).map((r: any) => r.item_id),
    ["item_d1", "item_d3", "item_d4"],
  );
  assert.equal(await state("d2"), "dropped");
  assert.equal(await state("sg"), "pending");
  await draft("d5", "s1");
  await draft("d6", "s1");
  assert.equal(
    (await call("draft.drop_all", { set: "s1" })).body.result.dropped,
    2,
  );
  assert.equal((await items()).length, 3);
  assert.equal(
    (await call("draft.drop_all", { set: "s1" })).body.result.dropped,
    0,
  );
});

const STILL_501: string[] = [];
// Out of scope for these handlers: scheduled commands (no Matt caller) and the ones waiting on other tasks.
const WAITING = ["weeklyreview.done", "set.write_with_ev"];

test("every command Matt calls directly has a handler, except the ones listed here", () => {
  const withoutHandler = commands
    .filter((c) => c.callers.matt && !commandHandlers[c.name])
    .map((c) => c.name)
    .sort();
  assert.deepEqual(withoutHandler, [...STILL_501, ...WAITING].sort());
  for (const n of [...STILL_501, ...WAITING])
    assert.ok(!commandHandlers[n], `${n} now has a handler: unlist it`);
});
