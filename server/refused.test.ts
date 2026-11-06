import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { WriteRefused } from "../data/index.ts";

// A DB whose every statement throws what a gate throws for a refused row; any route that reaches the data layer shows the mapping.
function failing(err: Error): Env["DB"] {
  const stmt = {
    bind: () => stmt,
    first: () => Promise.reject(err),
    all: () => Promise.reject(err),
    run: () => Promise.reject(err),
  };
  return {
    prepare: () => stmt,
    batch: () => Promise.reject(err),
  } as unknown as Env["DB"];
}
const call = (err: Error) =>
  app.request(
    "/api/v1/docs?collection=scratch&id=x",
    { headers: { authorization: "Bearer app-t" } },
    {
      DB: failing(err),
      TOKEN_APP: "app-t",
      TOKEN_SCHEDULE: "s",
    } as unknown as Env,
  );

test("a WriteRefused from the data layer answers 422 with the reason", async () => {
  const r = await call(new WriteRefused("plans", "two in force"));
  assert.equal(r.status, 422);
  assert.deepEqual(await r.json(), {
    error: "refused",
    message: "plans: two in force",
  });
});

test("any other failure is still a 500", async () => {
  assert.equal((await call(new Error("boom"))).status, 500);
});
