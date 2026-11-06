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
test("a date is a goals row, linked to objectives, changed in place and read as an exam", async () => {
  const { DB, call } = await setup();
  const get = async (path: string, token = "app-t") =>
    (
      await app.request(
        path,
        { headers: { authorization: `Bearer ${token}` } },
        { DB, TOKEN_APP: "app-t" } as unknown as Env,
      )
    ).json() as Promise<Record<string, any>>;
  await DB.prepare(
    "INSERT INTO collections (id, title, parent_id, pos, at, v) VALUES ('col_1', 'NUR', NULL, 0, 1, 1)",
  ).run();
  await DB.prepare(
    "INSERT INTO objectives (id, collection_id, num, text, chapters, source_ref, created_by, at, v) VALUES ('obj_1', 'col_1', 1, 'x', '[]', NULL, 'user', 1, 1)",
  ).run();
  const made = await call("date.create", {
    title: "Skills check",
    date: "2026-11-20",
    objectives: ["obj_1"],
  });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const { id } = made.body.result;
  assert.match(id, /^goal_/);
  const goal = await DB.prepare(
    "SELECT title, date, status FROM goals WHERE id = ?",
  )
    .bind(id)
    .first<Record<string, string>>();
  assert.deepEqual(
    { ...goal },
    { title: "Skills check", date: "2026-11-20", status: "open" },
  );
  const link = await DB.prepare("SELECT from_id FROM links WHERE to_id = ?")
    .bind(id)
    .first<{ from_id: string }>();
  assert.equal(link?.from_id, "obj_1");
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
  const listed = await get("/api/v1/docs?collection=exams");
  const shown = listed.docs.find((d: Record<string, any>) => d.id === id);
  assert.equal(shown.data.title, "Skills validation");
  assert.equal(shown.data.date, "2026-11-21");
  assert.equal(
    (await get(`/api/v1/docs?collection=exams&id=${id}`)).data.title,
    "Skills validation",
  );
  assert.equal(
    (await call("date.update", { id: "none", title: "x" })).status,
    404,
  );
  assert.equal(
    (await call("date.update", { id: "goal_none", title: "x" })).status,
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
  const bad = await call("date.create", {
    title: "y",
    date: "2026-12-01",
    objectives: ["obj_nope"],
  });
  assert.equal(bad.status, 404);
  assert.equal(
    (
      await DB.prepare(
        "SELECT COUNT(*) AS n FROM goals WHERE deleted_at IS NULL",
      ).first<{ n: number }>()
    )?.n,
    1,
  );
});

test("date.update changes a goal only; an id that is not a goal is a 404", async () => {
  const { call } = await setup();
  assert.equal(
    (await call("date.update", { id: "d1", date: "2026-11-21" })).status,
    404,
  );
});

test("a date's kind comes from the registry: other by default, set on create or update, anything else refused", async () => {
  const { DB, call } = await setup();
  const kindOf = async (id: string) =>
    (
      await DB.prepare("SELECT kind FROM goals WHERE id = ?")
        .bind(id)
        .first<{ kind: string }>()
    )?.kind;
  const plain = (
    await call("date.create", { title: "Trip", date: "2026-12-01" })
  ).body.result.id;
  assert.equal(await kindOf(plain), "other");
  const exam = (
    await call("date.create", {
      title: "Unit 3",
      date: "2026-12-02",
      kind: "exam",
    })
  ).body.result.id;
  assert.equal(await kindOf(exam), "exam");
  assert.equal(
    (await call("date.update", { id: plain, kind: "exam" })).status,
    200,
  );
  assert.equal(await kindOf(plain), "exam");
  assert.equal(
    (await call("date.update", { id: plain, kind: "quiz" })).status,
    400,
  );
  assert.equal(
    (
      await call("date.create", {
        title: "x",
        date: "2026-12-03",
        kind: "quiz",
      })
    ).status,
    400,
  );
});

test("a draft is kept into its set exactly once, or dropped; the whole set at once", async () => {
  const { DB, call, put } = await setup();
  const draft = (id: string, set: string, kind = "set-item") =>
    DB.prepare(
      "INSERT INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v) VALUES (?, 'j', ?, 'own_sets', ?, ?, 'pending', 1, 1)",
    )
      .bind(`draft_${id}`, kind, set, JSON.stringify({ q: id }))
      .run();
  await put("sets", "s1", { title: "S" });
  for (const id of ["d1", "d2", "d3", "d4"]) await draft(id, "s1");
  await draft("sg", "s1", "suggestion");
  const state = async (id: string) =>
    (
      await DB.prepare("SELECT state FROM drafts WHERE id = ?")
        .bind(`draft_${id}`)
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
