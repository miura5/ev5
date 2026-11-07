import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

const env = {
  DB: sqliteD1(),
  JOBS: { create: async () => undefined },
  ASSETS: { fetch: async () => new Response("x") },
  TOKEN_APP: "fake-app",
  TOKEN_SCHEDULE: "fake-schedule",
  TOKEN_EXECUTOR: "fake-executor",
};
const post = (name: string, token: string, json: unknown) =>
  app.request(
    `/api/v1/commands/${name}`,
    {
      method: "POST",
      headers: {
        "cf-connecting-ip": "9.9.9.9",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(json),
    },
    env,
  );

test("a caller the command does not list is refused", async () => {
  assert.equal(
    (await post("item.pin", "fake-schedule", { input: { id: "a" } })).status,
    403,
  );
  assert.equal((await post("morning", "fake-app", {})).status, 403);
  assert.equal(
    (await post("item.pin", "fake-executor", { input: { id: "a" } })).status,
    403,
  );
});

test("E.V. cannot call what the registry never gives it", async () => {
  assert.equal(
    (await post("item.pin", "fake-app", { as: "ev", input: { id: "a" } }))
      .status,
    403,
  );
});

test("an unknown command is 404 and a bad input is 400", async () => {
  assert.equal((await post("nope.nope", "fake-app", {})).status, 404);
  assert.equal((await post("item.pin", "fake-app", { input: {} })).status, 400);
});

test("a scheduled command is reachable by the schedule token, and has no handler yet", async () => {
  assert.equal((await post("morning", "fake-schedule", {})).status, 501);
});

test("an E.V. propose call makes a Suggestion", async () => {
  const r = await post("plan.create", "fake-app", {
    as: "ev",
    input: { title: "Review ch 4" },
  });
  assert.equal(r.status, 202);
  const b = (await r.json()) as {
    mode: string;
    suggestion: { command: string; title: string };
  };
  assert.equal(b.mode, "propose");
  assert.equal(b.suggestion.command, "plan.create");
});
