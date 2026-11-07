import { test } from "vitest";
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
    "/api/v1/goals/x",
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

test("any other failure is a 500 that gives a request id and logs it, without the message", async () => {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (m: unknown) => void lines.push(String(m));
  let r: Response;
  try {
    r = await call(new Error("row text: Matt secret-value"));
  } finally {
    console.error = orig;
  }
  assert.equal(r.status, 500);
  const body = (await r.json()) as { error: string; requestId: string };
  assert.equal(body.error, "internal");
  assert.equal(lines.length, 1);
  const logged = JSON.parse(lines[0]!) as { requestId: string; name: string };
  assert.equal(logged.requestId, body.requestId);
  assert.equal(logged.name, "Error");
  assert.ok(!lines[0]!.includes("secret-value"));
});
