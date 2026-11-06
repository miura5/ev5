import test from "node:test";
import assert from "node:assert/strict";
import type { ModelCall } from "../jobs/index.ts";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

const open = {
  schema: 3,
  writer: "worker",
  at: "2026-11-01T10:00:00.000Z",
  source: "test",
  kind: "review",
  title: "T",
  items: [
    {
      id: "o1",
      stem: "Why does fluid shift out of vessels in sepsis?",
      type: "open",
      modelAnswer: "Capillaries leak, so fluid moves into tissue.",
      keyPoints: [
        { text: "capillaries leak", keywords: [["leak"]] },
        { text: "fluid enters tissue", keywords: [["tissue"]] },
      ],
      sourceRef: "note/n1",
    },
  ],
};

async function rig(text: string) {
  const s = await setup();
  for (const [k, v] of Object.entries({
    ceiling_hourly: 5e9,
    ceiling_daily: 5e9,
    ceiling_monthly: 5e9,
    ceiling_per_job: 5e9,
  }))
    await s.DB.prepare("INSERT INTO claude_settings (key, value, at) VALUES (?, ?, 0)").bind(k, v).run();
  await s.put("sets", "s1", open);
  const seen: string[] = [];
  const ASK_CALL: ModelCall = async (req) => {
    seen.push(req.messages[0]?.content ?? "");
    return { stopReason: "end_turn", text, usage: { inputTokens: 300, outputTokens: 40 } };
  };
  const env = { DB: s.DB, TOKEN_APP: "app-t", ASK_CALL } as unknown as Env;
  const attempt = async (answer: string) => {
    const r = await app.request(
      "/api/v1/commands/study.attempt",
      { method: "POST", headers: { authorization: "Bearer app-t" }, body: JSON.stringify({ input: { id: "s1/o1", answer } }) },
      env,
    );
    return { status: r.status, body: (await r.json()) as Record<string, any> };
  };
  return { ...s, attempt, seen };
}

test("a typed open answer is graded by the model and the score is kept with the answer", async () => {
  const { attempt, seen, DB } = await rig('{"score":0.85,"note":"Good; name the tissue."}');
  const r = await attempt("The capillaries leak into the tissue.");
  assert.equal(r.status, 200);
  assert.equal(r.body.result.score, 0.85);
  assert.equal(r.body.result.correct, true);
  assert.equal(r.body.result.reveal, undefined);
  assert.match(seen[0] ?? "", /Reference answer: Capillaries leak/);
  const d = await DB.prepare("SELECT data FROM docs WHERE c = 'answers'").first<{ data: string }>();
  const entry = Object.values((JSON.parse(d!.data).answers as any).o1)[0] as any;
  assert.equal(entry.score, 0.85);
});

test("a long answer is kept past 600 characters only with a note that it was cut, and is refused past the grading limit", async () => {
  const { attempt, DB } = await rig('{"score":0.2,"note":"Thin."}');
  assert.equal((await attempt("x".repeat(700))).status, 200);
  const d = await DB.prepare("SELECT data FROM docs WHERE c = 'answers'").first<{ data: string }>();
  const entry = Object.values((JSON.parse(d!.data).answers as any).o1)[0] as any;
  assert.equal(entry.text.length, 600);
  assert.equal(entry.textCut, true);
  assert.equal(entry.textLength, 700);
  assert.equal((await attempt("x".repeat(4001))).status, 400);
});

test("a model reply that is not a grade fails the attempt and records nothing", async () => {
  const { attempt, DB } = await rig("not json");
  assert.equal((await attempt("An answer.")).status, 502);
  const n = await DB.prepare("SELECT count(*) AS n FROM docs WHERE c = 'answers'").first<{ n: number }>();
  assert.equal(n?.n, 0);
});
