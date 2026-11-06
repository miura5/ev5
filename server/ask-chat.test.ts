import test from "node:test";
import assert from "node:assert/strict";
import { d1JobStore } from "../jobs/index.ts";
import type { ModelCall } from "../jobs/index.ts";
import app from "./index.ts";
import { putNoteRow, sqliteD1 } from "./sqlite-d1.test.ts";

const NOTE = {
  title: "Heart rate",
  blocks: [
    {
      type: "p",
      runs: [{ text: "Bradycardia is a pulse under sixty beats a minute." }],
    },
  ],
};

function setup(
  reply: object | ((n: number) => object),
  settings: Record<string, number> = {},
) {
  const db = sqliteD1();
  db.prepare(
    "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  db.prepare(
    "CREATE TABLE deletions (c TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  void putNoteRow(db, "n-1", NOTE.title, NOTE.blocks[0]!.runs[0]!.text);
  for (const [k, v] of Object.entries(settings))
    db.prepare("INSERT INTO claude_settings (key, value, at) VALUES (?, ?, 0)")
      .bind(k, v)
      .run();
  const calls: string[] = [];
  const call: ModelCall = async (req) => {
    calls.push(req.messages.map((m) => m.content).join("\n"));
    const r = typeof reply === "function" ? reply(calls.length) : reply;
    return {
      stopReason: "end_turn",
      text: JSON.stringify(r),
      usage: { inputTokens: 500, outputTokens: 100 },
    };
  };
  const env = {
    DB: db,
    JOBS: { create: async () => undefined },
    ASSETS: { fetch: async () => new Response("x") },
    TOKEN_APP: "fake-app",
    ASK_CALL: call,
  };
  const ask = (text: string, token = "fake-app") =>
    app.request(
      "/api/v1/ask",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "cf-connecting-ip": "9.9.9.9",
        },
        body: JSON.stringify({ text }),
      },
      env,
    );
  return { ask, calls, db };
}

test("a reply that cites a note it was given shows that note as its source", async () => {
  const { ask } = setup({ text: "Under 60.", cited: ["n-1"], asksTry: false });
  const body = (await (await ask("what is bradycardia?")).json()) as any;
  assert.equal(body.reply.unverified, false);
  assert.equal(body.reply.source, "Heart rate");
});

test("a reply with no sources is unverified", async () => {
  const { ask } = setup({ text: "Probably.", cited: [], asksTry: false });
  const body = (await (await ask("what is bradycardia?")).json()) as any;
  assert.equal(body.reply.unverified, true);
});

test("a cited id that was not given gets one repair ask, then shows unverified", async () => {
  const { ask, calls } = setup({
    text: "Made up.",
    cited: ["n-zzz"],
    asksTry: false,
  });
  const body = (await (await ask("what is bradycardia?")).json()) as any;
  assert.equal(calls.length, 2);
  assert.equal(body.reply.unverified, true);
  assert.equal(body.reply.source, undefined);
});

test("a running job's state is in the prompt, so 'is it ready?' is answered from job_status", async () => {
  const { ask, calls, db } = setup({
    text: "Not yet.",
    cited: [],
    asksTry: false,
  });
  await ask("is it ready?");
  assert.match(calls[0] as string, /Jobs now:\n- none running/);
  const t = "2026-11-03T12:00:00Z";
  await d1JobStore(db, () => 0).put({
    id: "j1",
    kind: "practice_set",
    title: "Practice set",
    state: "running",
    costCents: 0,
    createdAt: t,
    updatedAt: t,
    v: 1,
  });
  await ask("is it ready?");
  assert.match(calls[1] as string, /writing your questions\. \(activity\)/);
});

test("a ceiling hit says so and nothing is asked of the model", async () => {
  const { ask, calls } = setup(
    { text: "x", cited: [], asksTry: false },
    {
      ceiling_hourly: 0,
      ceiling_daily: 5_000_000,
      ceiling_monthly: 40_000_000,
      ceiling_per_job: 1_000_000,
    },
  );
  const res = await ask("what is bradycardia?");
  assert.equal(res.status, 429);
  assert.match(((await res.json()) as any).error, /hourly/);
  assert.equal(calls.length, 0);
});

test("only the app token may ask, and empty text is refused", async () => {
  const { ask } = setup({ text: "x", cited: [], asksTry: false });
  assert.equal((await ask("hi", "nope")).status, 401);
  assert.equal((await ask("  ")).status, 400);
});
