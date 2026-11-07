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

test("moving a repeating item onto a day its repeat already holds is a plain 409, never a 500, and writes nothing", async () => {
  const { call, day, item } = await setup();
  const made = await call("plan.create", {
    title: "Flashcards",
    date: "2026-11-05",
    repeat: "weekdays",
  });
  const { id } = made.body.result;
  const [fri] = await day("2026-11-06");
  const moved = await call("plan.update", { id, date: "2026-11-06" });
  assert.equal(moved.status, 409);
  assert.match(String(moved.body.message ?? moved.body.error), /already/i);
  assert.equal((await item(id))?.day, "2026-11-05");
  assert.equal((await day("2026-11-06")).length, 1);
  assert.equal((await day("2026-11-06"))[0]?.id, fri?.id);
  const tomorrow = await call("plan.move_tomorrow", { id });
  assert.equal(tomorrow.status, 409);
});

test("a save onto a day its repeat already holds (gate or unique index) is a 409 with a plain reason", async () => {
  const { saveItem } = await import("./plan-days.ts");
  const { DB } = await setup();
  const boom = new Error(
    "UNIQUE constraint failed: plan_items.repeat_id, plan_items.day",
  );
  const db = {
    prepare: (sql: string) => {
      const st = DB.prepare(sql);
      const w: any = {
        bind: (...v: (string | number | null)[]) => (st.bind(...v), w),
        first: () => st.first(),
        all: () => st.all(),
        run: () =>
          /insert into plan_items/i.test(sql) ? Promise.reject(boom) : st.run(),
      };
      return w;
    },
    batch: () => Promise.reject(boom),
  };
  await DB.prepare(
    "INSERT INTO plan_items (id, plan_id, day, pos, title, minutes, time, origin, linked_kind, linked_id, repeat_id, done_at, at, v) VALUES ('pli_a', NULL, '2026-11-06', 0, 't', NULL, NULL, 'user', NULL, NULL, 'rep_x', NULL, 1, 1)",
  ).run();
  const x = { db, clock: () => 1, newId: () => "z" } as never;
  await assert.rejects(
    saveItem(
      x,
      {
        id: "pli_n",
        plan_id: null,
        day: "2026-11-06",
        pos: 0,
        title: "t",
        minutes: null,
        time: null,
        origin: "user",
        linked_kind: null,
        linked_id: null,
        repeat_id: "rep_x",
        done_at: null,
      },
      null,
    ),
    (e: any) => e.status === 409 && /already/.test(e.message),
  );
});
