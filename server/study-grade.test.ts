import test from "node:test";
import assert from "node:assert/strict";
import type { ModelCall } from "../jobs/index.ts";
import { tablesRepo } from "../data/index.ts";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

const open = {
  stem: "Why does fluid shift out of vessels in sepsis?",
  type: "open",
  modelAnswer: "Capillaries leak, so fluid moves into tissue.",
  keyPoints: [
    { text: "capillaries leak", keywords: [["leak"]] },
    { text: "fluid enters tissue", keywords: [["tissue"]] },
  ],
  sourceRef: "note_n1",
};

type Attempt = { score: number | null; answer: string };
const lastAttempt = async (DB: Awaited<ReturnType<typeof setup>>["DB"]) =>
  DB.prepare("SELECT score, answer FROM attempts").first<Attempt>();

async function rig(text: string) {
  const s = await setup();
  for (const [k, v] of Object.entries({
    ceiling_hourly: 5e9,
    ceiling_daily: 5e9,
    ceiling_monthly: 5e9,
    ceiling_per_job: 5e9,
  }))
    await s.DB.prepare("INSERT INTO settings (key, value, at) VALUES (?, ?, 0)").bind(k, v).run();
  const book = tablesRepo(s.DB, { clock: () => 1000 }).setBook;
  await book.create({
    id: "set_s1",
    collection_id: null,
    kind: "own",
    title: "T",
    source_kind: null,
    source_id: null,
    created_by: "user",
    job_id: null,
    focus: null,
    asked: null,
  });
  await book.addItem({
    id: "item_o1",
    set_id: "set_s1",
    pos: 1,
    type: "open",
    body: open,
    objective_id: null,
    weak_spot_id: null,
    source_ref: null,
  });
  const seen: string[] = [];
  const ASK_CALL: ModelCall = async (req) => {
    seen.push(req.messages[0]?.content ?? "");
    return { stopReason: "end_turn", text, usage: { inputTokens: 300, outputTokens: 40 } };
  };
  const env = { DB: s.DB, TOKEN_APP: "app-t", ASK_CALL } as unknown as Env;
  const attempt = async (answer: string) => {
    const r = await app.request(
      "/api/v1/commands/study.attempt",
      { method: "POST", headers: { authorization: "Bearer app-t" }, body: JSON.stringify({ input: { id: "set_s1/item_o1", answer } }) },
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
  assert.equal((await lastAttempt(DB))?.score, 0.85);
});

test("a long answer is kept as an attempt and is refused past the grading limit", async () => {
  const { attempt, DB } = await rig('{"score":0.2,"note":"Thin."}');
  assert.equal((await attempt("x".repeat(700))).status, 200);
  const a = await lastAttempt(DB);
  assert.equal(a?.score, 0.2);
  assert.ok(JSON.parse(String(a?.answer)).text.length > 0);
  assert.equal((await attempt("x".repeat(4001))).status, 400);
});

test("a model reply that is not a grade fails the attempt and records nothing", async () => {
  const { attempt, DB } = await rig("not json");
  assert.equal((await attempt("An answer.")).status, 502);
  const n = await DB.prepare("SELECT count(*) AS n FROM attempts").first<{ n: number }>();
  assert.equal(n?.n, 0);
});
