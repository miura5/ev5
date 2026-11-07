import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { commands } from "../commands/index.ts";
import { commandHandlers } from "./command-handlers.ts";
import { sqliteD1 } from "./sqlite-d1.testkit.ts";

async function setup() {
  const DB = sqliteD1();
  for (const f of ["0000_baseline"])
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
  /** The plan_items rows of one day, by position. */
  const day = async (d: string) =>
    (
      await DB.prepare(
        "SELECT * FROM plan_items WHERE day = ? ORDER BY pos, id",
      )
        .bind(d)
        .all<Record<string, any>>()
    ).results;
  const item = async (id: string) =>
    DB.prepare("SELECT * FROM plan_items WHERE id = ?")
      .bind(id)
      .first<Record<string, any>>();
  return { call, day, item, DB };
}

test("an E.V. plan.create makes a Suggestion that the user accepts into their day", async () => {
  const { call, day } = await setup();
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
  assert.deepEqual(await day("2026-11-05"), []);
  const id = made.body.suggestion.id as string;
  const ok = await call("proposal.accept", { id });
  assert.equal(ok.status, 200);
  const [row] = await day("2026-11-05");
  assert.equal(row?.id, ok.body.result.result.id);
  assert.match(row?.id, /^pli_/);
  assert.equal(row?.title, "Read ch 4");
  assert.equal(row?.minutes, 30);
  assert.equal(row?.time, "09:00");
  assert.equal(row?.origin, "user");
  assert.equal(row?.plan_id, null);
  assert.equal(row?.done_at, null);
  assert.equal((await call("proposal.accept", { id })).status, 404); // applies once
});

test("a Suggestion is edited, or dismissed and never applied", async () => {
  const { call, day } = await setup();
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
  assert.equal((await day("2026-11-06"))[0]?.title, "B");
  const d = (
    await call("plan.create", { title: "C", date: "2026-11-07" }, "ev")
  ).body.suggestion.id;
  assert.equal((await call("proposal.dismiss", { id: d })).status, 200);
  assert.equal((await call("proposal.accept", { id: d })).status, 404);
  assert.deepEqual(await day("2026-11-07"), []);
});

test("update, move to tomorrow and toggle change the item's own row", async () => {
  const { call, item } = await setup();
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
  assert.equal((await item(id))?.v, 2);
  assert.equal((await call("plan.toggle_done", { id })).body.result.done, true);
  assert.equal(typeof (await item(id))?.done_at, "number");
  assert.equal(
    (await call("plan.toggle_done", { id })).body.result.done,
    false,
  );
  assert.equal((await item(id))?.done_at, null);
  const moved = await call("plan.move_tomorrow", { id });
  assert.equal(moved.body.result.date, "2026-11-06");
  const row = await item(id);
  assert.equal(row?.day, "2026-11-06");
  assert.equal(row?.title, "Skills lab");
  assert.equal(row?.minutes, 45);
  assert.equal((await call("plan.toggle_done", { id })).status, 200);
  assert.equal(
    (await call("plan.update", { id: "none", title: "x" })).status,
    404,
  );
  assert.equal(
    (await call("plan.create", { title: "x", repeat: "sometimes" })).status,
    400,
  );
});

test("no command the user calls directly answers 501 for the commands these handlers cover", async () => {
  const covered = Object.keys(commandHandlers).filter((n) =>
    /^(plan|proposal)\./.test(n),
  );
  assert.ok(covered.length >= 9);
  for (const c of commands.filter(
    (x) => /^(plan|proposal)\./.test(x.name) && x.callers.matt,
  ))
    assert.ok(covered.includes(c.name), `${c.name} has no handler`);
});

test("a repeat is a repeats row, and each day's occurrence is a plan item with its repeat_id", async () => {
  const { call, day, item, DB } = await setup();
  const made = await call("plan.create", {
    title: "Flashcards",
    date: "2026-11-05",
    estimateMinutes: 15,
    time: "20:00",
    repeat: "weekdays",
  });
  assert.equal(made.status, 200);
  const { id } = made.body.result;
  const first = await item(id);
  assert.equal(first?.time, "20:00");
  assert.match(first?.repeat_id, /^rep_/);
  const rep = await DB.prepare("SELECT * FROM repeats WHERE id = ?")
    .bind(first?.repeat_id)
    .first<Record<string, any>>();
  assert.deepEqual(JSON.parse(rep?.rule), { kind: "weekdays" });
  assert.equal(rep?.from_day, "2026-11-05");
  // 2026-11-05 is a Thursday: Fri 6, then Mon 9 .. Fri 13, Mon 16 .. Thu 19 (14 days ahead)
  const [fri] = await day("2026-11-06");
  assert.equal(fri?.title, "Flashcards");
  assert.equal(fri?.minutes, 15);
  assert.equal(fri?.repeat_id, first?.repeat_id);
  assert.equal(fri?.done_at, null);
  assert.deepEqual(await day("2026-11-07"), []); // a Saturday
  assert.equal((await day("2026-11-09")).length, 1);
  // an update re-runs it: nothing doubles, and the user's edit to an occurrence stays
  await call("plan.toggle_done", { id: fri?.id });
  assert.equal(
    (await call("plan.update", { id, estimateMinutes: 20 })).status,
    200,
  );
  assert.equal((await day("2026-11-06")).length, 1);
  assert.equal(typeof (await item(fri?.id))?.done_at, "number");
  // clearing the repeat keeps the time
  assert.equal((await call("plan.update", { id, repeat: "none" })).status, 200);
  const cleared = await item(id);
  assert.equal(cleared?.repeat_id, null);
  assert.equal(cleared?.time, "20:00");
});

test("a link and a collection are kept, and a bad option writes nothing", async () => {
  const { call, day, item, DB } = await setup();
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
  const p = await item(id);
  assert.equal(p?.linked_kind, "goal");
  assert.equal(p?.linked_id, "e1");
  const m = await DB.prepare("SELECT * FROM memberships WHERE item_id = ?")
    .bind(id)
    .first<Record<string, any>>();
  assert.equal(m?.collection_id, "col_c1");
  // a course: target is refused, and the item stays where it was
  assert.equal(
    (await call("plan.update", { id, collection: "course:Biology" })).status,
    400,
  );
  assert.equal(
    (
      await DB.prepare("SELECT * FROM memberships WHERE item_id = ?")
        .bind(id)
        .first<Record<string, any>>()
    )?.collection_id,
    "col_c1",
  );
  // "none" takes it out
  assert.equal(
    (await call("plan.update", { id, collection: "none" })).status,
    200,
  );
  assert.equal(
    await DB.prepare("SELECT * FROM memberships WHERE item_id = ?")
      .bind(id)
      .first(),
    null,
  );
  for (const bad of [
    { linked: "nowhere" },
    { collection: "missing" },
    { time: "25:00" },
    { repeat: "weekly:9" },
  ])
    assert.equal(
      (await call("plan.create", { title: "Bad", date: "2026-11-08", ...bad }))
        .status,
      400,
      JSON.stringify(bad),
    );
  assert.deepEqual(await day("2026-11-08"), []);
});

test("a repeat is a Suggestion until the user accepts it", async () => {
  const { call, day } = await setup();
  const s = await call(
    "plan.create",
    { title: "R", date: "2026-11-05", repeat: "daily" },
    "ev",
  );
  assert.equal(s.status, 202);
  assert.deepEqual(await day("2026-11-06"), []);
  assert.equal(
    (await call("proposal.accept", { id: s.body.suggestion.id })).status,
    200,
  );
  assert.equal((await day("2026-11-06")).length, 1);
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

test("plan.toggle_done with done and if_version is idempotent and refuses a stale copy", async () => {
  const { call, item } = await setup();
  const { id } = (await call("plan.create", { title: "Tick" })).body.result;
  const v = ((await item(id))?.v ?? 0) as number;
  const set = (done: boolean, if_version?: number) => call("plan.toggle_done", { id, done, if_version });
  await set(true, v);
  await set(true, v + 1);
  assert.equal((await item(id))?.v, v + 1);
  assert.equal((await set(false, v)).status, 409);
  assert.equal((await set(false)).body.result.done, false); // no version: old behaviour
});
