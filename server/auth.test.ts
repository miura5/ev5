import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import { createLimiter, inScope, tokenMatches } from "./auth.ts";

// Fake tokens, never real ones.
const env = {
  DB: { prepare: () => ({ first: async () => null }) },
  ASSETS: { fetch: async () => new Response("x") },
  TOKEN_APP: "fake-app",
  TOKEN_SCHEDULE: "fake-schedule",
  TOKEN_EXECUTOR: "fake-executor",
};
const get = (path: string, token?: string, ip = "1.1.1.1") =>
  app.request(
    path,
    {
      headers: {
        "cf-connecting-ip": ip,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    },
    env,
  );

test("each token identifies its caller", async () => {
  for (const [t, who] of [
    ["fake-app", "app"],
    ["fake-schedule", "schedule"],
    ["fake-executor", "executor"],
  ] as const) {
    const res = await get("/api/v1/whoami", t);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { caller: who });
  }
});

test("missing, wrong and unset tokens are 401", async () => {
  assert.equal((await get("/api/v1/whoami")).status, 401);
  assert.equal((await get("/api/v1/whoami", "nope")).status, 401);
  const res = await app.request(
    "/api/v1/whoami",
    { headers: { authorization: "Bearer x" } },
    { ...env, TOKEN_APP: undefined },
  );
  assert.equal(res.status, 401);
});

test("tokens are scoped to their routes", async () => {
  assert.equal((await get("/api/v1/other", "fake-schedule")).status, 403);
  assert.equal((await get("/api/v1/jobs/x", "fake-executor")).status, 403);
  assert.equal(inScope("executor", "/api/v1/executor/next"), true);
  assert.equal(inScope("schedule", "/api/v1/whoamix"), false);
  assert.equal((await get("/api/v1/other", "fake-app")).status, 404);
});

test("wrong attempts are rate-limited per client, then 429 even for a right token", async () => {
  let last = 0;
  for (let i = 0; i < 12; i++)
    last = (await get("/api/v1/whoami", "bad", "9.9.9.9")).status;
  assert.equal(last, 429);
  assert.equal(
    (await get("/api/v1/whoami", "fake-app", "9.9.9.9")).status,
    429,
  );
  assert.equal(
    (await get("/api/v1/whoami", "fake-app", "8.8.8.8")).status,
    200,
  );
});

test("limiter window resets and tokenMatches compares exactly", async () => {
  let t = 0;
  const l = createLimiter(2, 100, () => t);
  l.fail("k");
  l.fail("k");
  assert.equal(l.blocked("k"), true);
  t = 101;
  assert.equal(l.blocked("k"), false);
  assert.equal(await tokenMatches("a", "a"), true);
  assert.equal(await tokenMatches("a", "ab"), false);
});

test("ev4 routes stay 410 without a token", async () => {
  assert.equal((await get("/api/db/docs/x")).status, 410);
  assert.equal((await get("/api/run/x")).status, 410);
});
