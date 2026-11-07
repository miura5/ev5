import test from "node:test";
import assert from "node:assert/strict";
import { d1JobStore } from "../jobs/index.ts";
import type { ModelCall } from "../jobs/index.ts";
import app from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

function setup(monthly: number) {
  const db = sqliteD1();
  db.prepare(
    "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  db.prepare(
    "CREATE TABLE deletions (c TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  for (const [k, v] of Object.entries({
    ceiling_hourly: 5e9,
    ceiling_daily: 5e9,
    ceiling_monthly: monthly,
    ceiling_per_job: 5e9,
  }))
    db.prepare("INSERT INTO settings (key, value, at) VALUES (?, ?, 0)")
      .bind(k, v)
      .run();
  const held: number[] = [];
  const call: ModelCall = async () => {
    // While the model runs, the month's use is exactly this turn's reservation.
    const row = await db
      .prepare("SELECT used FROM ceiling_use WHERE w = 'month'")
      .first<{ used: number }>();
    held.push(row?.used ?? 0);
    return answer;
  };
  const answer = {
    stopReason: "end_turn",
    text: JSON.stringify({ text: "Ok.", cited: [], asksTry: false }),
    usage: { inputTokens: 500, outputTokens: 100 },
  } as const;
  const env = {
    DB: db,
    JOBS: { create: async () => undefined },
    ASSETS: { fetch: async () => new Response("x") },
    TOKEN_APP: "fake-app",
    ASK_CALL: call,
  };
  const post = (path: string, body: object) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          authorization: "Bearer fake-app",
          "cf-connecting-ip": "9.9.9.9",
        },
        body: JSON.stringify(body),
      },
      env,
    );
  return { post, db, held };
}

async function alerts(db: ReturnType<typeof sqliteD1>) {
  const jobs = await d1JobStore(db, () => 0).list();
  return jobs.filter((j) => j.kind === "spend-alert");
}

test("an Ask turn that takes the month past 80% writes the spend-alert needs-you record", async () => {
  const { post, db, held } = setup(1_000_000_000);
  assert.equal(
    (await post("/api/v1/ask", { text: "what is bradycardia?" })).status,
    200,
  );
  assert.equal((await alerts(db)).length, 0);
  const reserved = held[0] ?? 0;
  assert.ok(reserved > 0);
  const low = setup(Math.ceil(reserved * 1.1));
  await low.post("/api/v1/ask", { text: "what is bradycardia?" });
  const got = await alerts(low.db);
  assert.equal(got.length, 1);
  assert.equal(got[0]?.state, "needs-you");
});

test("ask.send runs the same ask path as /api/v1/ask", async () => {
  const { post } = setup(1_000_000_000);
  const res = await post("/api/v1/commands/ask.send", {
    input: { text: "what is bradycardia?" },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    mode: string;
    result: { reply: { text: string } };
  };
  assert.equal(body.mode, "direct");
  assert.equal(body.result.reply.text, "Ok.");
});

test("ask.send answers 429 when a ceiling is hit, like /api/v1/ask", async () => {
  const { post } = setup(0);
  assert.equal(
    (await post("/api/v1/commands/ask.send", { input: { text: "hi there" } }))
      .status,
    429,
  );
});

test("ask.send passes chat_id to the ask path", async () => {
  const { post } = setup(1_000_000_000);
  const res = await post("/api/v1/commands/ask.send", {
    input: { text: "what is bradycardia?", chat_id: "chat_abc" },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { result: { reply: { chatId?: string } } };
  assert.equal(body.result.reply.chatId, "chat_abc");
});
