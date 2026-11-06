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
  const call = async (name: string, input: unknown, as?: string) => {
    const r = await app.request(
      `/api/v1/commands/${name}`,
      {
        method: "POST",
        headers: { authorization: "Bearer app-t" },
        body: JSON.stringify({ input, as }),
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
  return { call, doc, DB };
}

test("an E.V. plan.create makes a Suggestion that Matt accepts into his day", async () => {
  const { call, doc } = await setup();
  const made = await call(
    "plan.create",
    {
      title: "Read ch 4",
      date: "2026-11-05",
      estimateMinutes: 30,
      time: "09:00",
    },
    "ev",
  );
  assert.equal(made.status, 202);
  assert.equal(await doc("dayedits", "2026-11-05"), null);
  const id = made.body.suggestion.id as string;
  const ok = await call("proposal.accept", { id });
  assert.equal(ok.status, 200);
  const day = await doc("dayedits", "2026-11-05");
  assert.equal(day?.added[ok.body.result.result.id].text, "Read ch 4");
  assert.equal(day?.added[ok.body.result.result.id].by, "Matt");
  assert.equal((await call("proposal.accept", { id })).status, 404); // applies once
});

test("a Suggestion is edited, or dismissed and never applied", async () => {
  const { call, doc } = await setup();
  const a = (
    await call("plan.create", { title: "A", date: "2026-11-06" }, "ev")
  ).body.suggestion.id;
  assert.equal(
    (await call("proposal.edit", { id: a, input: { title: "B" } })).status,
    200,
  );
  assert.equal(
    (await call("proposal.edit", { id: a, input: { title: "" } })).status,
    400,
  );
  await call("proposal.accept", { id: a });
  assert.equal(
    (await doc("dayedits", "2026-11-06"))?.added[
      Object.keys((await doc("dayedits", "2026-11-06"))?.added)[0] as string
    ].text,
    "B",
  );
  const d = (
    await call("plan.create", { title: "C", date: "2026-11-07" }, "ev")
  ).body.suggestion.id;
  assert.equal((await call("proposal.dismiss", { id: d })).status, 200);
  assert.equal((await call("proposal.accept", { id: d })).status, 404);
  assert.equal(await doc("dayedits", "2026-11-07"), null);
});

test("update, move to tomorrow and toggle keep every write one ev4 accepts", async () => {
  const { call, doc } = await setup();
  const { id } = (
    await call("plan.create", { title: "Skills", date: "2026-11-05" })
  ).body.result;
  assert.equal(
    (
      await call("plan.update", {
        id,
        title: "Skills lab",
        estimateMinutes: 45,
      })
    ).status,
    200,
  );
  assert.equal((await call("plan.toggle_done", { id })).body.result.done, true);
  assert.equal(
    (await call("plan.toggle_done", { id })).body.result.done,
    false,
  );
  const moved = await call("plan.move_tomorrow", { id });
  assert.equal(moved.body.result.date, "2026-11-06");
  assert.equal(
    (await doc("dayedits", "2026-11-06"))?.added[id].text,
    "Skills lab",
  );
  assert.ok((await doc("dayedits", "2026-11-05"))?.skipped[id]);
  assert.equal((await call("plan.toggle_done", { id })).status, 200); // finds the new day
  assert.equal(
    (await call("plan.update", { id: "none", title: "x" })).status,
    404,
  );
  assert.equal(
    (await call("plan.create", { title: "x", repeat: "sometimes" })).status,
    400,
  );
});

test("no command Matt calls directly answers 501 for the commands these handlers cover", async () => {
  const covered = Object.keys(commandHandlers).filter((n) =>
    /^(plan|proposal)\./.test(n),
  );
  assert.ok(covered.length >= 9);
  for (const c of commands.filter(
    (x) => /^(plan|proposal)\./.test(x.name) && x.callers.matt,
  ))
    assert.ok(covered.includes(c.name), `${c.name} has no handler`);
});

test("a repeat is saved and materializes into dayedits.added under rep-<id>-<date>", async () => {
  const { call, doc, DB } = await setup();
  const made = await call("plan.create", {
    title: "Flashcards",
    date: "2026-11-05",
    estimateMinutes: 15,
    time: "20:00",
    repeat: "weekdays",
  });
  assert.equal(made.status, 200);
  const { id } = made.body.result;
  const props = await DB.prepare("SELECT * FROM item_props WHERE id = ?")
    .bind(id)
    .first<Record<string, any>>();
  assert.equal(props?.time, "20:00");
  assert.deepEqual(JSON.parse(props?.repeat), { kind: "weekdays" });
  // 2026-11-05 is a Thursday: Fri 6, then Mon 9 .. Fri 13, Mon 16 .. Thu 19 (14 days ahead)
  const fri = await doc("dayedits", "2026-11-06");
  assert.equal(fri?.added[`rep-${id}-2026-11-06`].text, "Flashcards");
  assert.equal(fri?.added[`rep-${id}-2026-11-06`].minutes, 15);
  assert.equal(await doc("dayedits", "2026-11-07"), null); // a Saturday
  assert.ok((await doc("dayedits", "2026-11-09"))?.added[`rep-${id}-2026-11-09`]);
  // an update re-runs it: nothing doubles, and Matt's edit to an occurrence stays
  const before = (await doc("dayedits", "2026-11-06"))?.v;
  assert.equal((await call("plan.update", { id, estimateMinutes: 20 })).status, 200);
  assert.equal(
    Object.keys((await doc("dayedits", "2026-11-06"))?.added).length,
    1,
  );
  assert.equal((await doc("dayedits", "2026-11-06"))?.v, before);
  // clearing the repeat keeps the time
  assert.equal((await call("plan.update", { id, repeat: "none" })).status, 200);
  const cleared = await DB.prepare("SELECT * FROM item_props WHERE id = ?")
    .bind(id)
    .first<Record<string, any>>();
  assert.equal(cleared?.repeat, null);
  assert.equal(cleared?.time, "20:00");
});

test("a link and a collection are kept, and a bad option writes nothing", async () => {
  const { call, doc, DB } = await setup();
  await DB.prepare(
    "INSERT INTO collections (id, title, parent_id, pos, at, v) VALUES ('col_c1', 'Skills', NULL, 0, 1, 1)",
  ).run();
  const { id } = (
    await call("plan.create", {
      title: "Lab",
      date: "2026-11-05",
      linked: "exams/e1",
      collection: "col_c1",
    })
  ).body.result;
  const p = await DB.prepare("SELECT * FROM item_props WHERE id = ?")
    .bind(id)
    .first<Record<string, any>>();
  assert.equal(p?.linked_c, "exams");
  assert.equal(p?.linked_id, "e1");
  const m = await DB.prepare("SELECT * FROM memberships WHERE item_id = ?")
    .bind(id)
    .first<Record<string, any>>();
  assert.equal(m?.collection_id, "col_c1");
  // into a course: ev4's field, the row goes
  assert.equal(
    (await call("plan.update", { id, collection: "course:NUR 112" })).status,
    200,
  );
  assert.equal((await doc("dayedits", "2026-11-05"))?.added[id].course, "NUR 112");
  assert.equal(
    await DB.prepare("SELECT * FROM memberships WHERE item_id = ?").bind(id).first(),
    null,
  );
  for (const bad of [
    { linked: "nowhere" },
    { collection: "missing" },
    { time: "25:00" },
    { repeat: "weekly:9" },
  ])
    assert.equal(
      (await call("plan.create", { title: "Bad", date: "2026-11-08", ...bad })).status,
      400,
      JSON.stringify(bad),
    );
  assert.equal(await doc("dayedits", "2026-11-08"), null);
});

test("a repeat is a Suggestion until Matt accepts it", async () => {
  const { call, doc } = await setup();
  const s = await call("plan.create", { title: "R", date: "2026-11-05", repeat: "daily" }, "ev");
  assert.equal(s.status, 202);
  assert.equal(await doc("dayedits", "2026-11-06"), null);
  assert.equal((await call("proposal.accept", { id: s.body.suggestion.id })).status, 200);
  assert.ok(await doc("dayedits", "2026-11-06"));
});

test("a Suggestion whose command fails goes back to pending with a new version and time", async () => {
  const { call, DB } = await setup();
  const id = (
    await call("plan.create", { title: "A", date: "2026-11-08" }, "ev")
  ).body.suggestion.id as string;
  const row = () =>
    DB.prepare("SELECT state, at, v FROM drafts WHERE id = ?")
      .bind(`draft_${id}`)
      .first<{ state: string; at: string; v: number }>();
  const before = (await row())!;
  await DB.prepare("UPDATE drafts SET body = ? WHERE id = ?")
    .bind(JSON.stringify({ title: "A", date: "not-a-date" }), `draft_${id}`)
    .run();
  const failed = await call("proposal.accept", { id });
  assert.notEqual(failed.status, 200);
  const after = (await row())!;
  assert.equal(after.state, "pending");
  assert.equal(after.v, before.v + 2); // claimed, then handed back
  assert.ok(after.at);
});
