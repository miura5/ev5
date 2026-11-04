import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { commands } from "../commands/index.ts";
import { commandHandlers } from "./command-handlers.ts";
import { validateWrite } from "../data/compat-test.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup() {
  const DB = sqliteD1();
  for (const f of [
    "0000_baseline",
    "0001_deletions",
    "0003_collections_pins_own",
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
  return { call, doc };
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
  assert.deepEqual(validateWrite("dayedits", day, { id: "2026-11-05" }), {
    ok: true,
  });
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
  for (const d of ["2026-11-05", "2026-11-06"])
    assert.deepEqual(
      validateWrite("dayedits", await doc("dayedits", d), { id: d }),
      { ok: true },
    );
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
    (await call("plan.create", { title: "x", repeat: "daily" })).status,
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
