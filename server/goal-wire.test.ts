// A goal made by date.create reads as an exam document without a plan field: the plan comes from the `plans` rows
// (goal-wire.ts), which Library and Today read themselves.
import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

test("a date made with date.create shows as an exam document with no planId", async () => {
  const { DB, call } = await setup();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const made = await call("date.create", {
    title: "Final exam",
    date: "2999-12-01",
    kind: "exam",
  });
  const { id } = made.body.result;
  const res = await app.request(
    "/api/v1/docs?collection=exams",
    { headers: { authorization: "Bearer app-t" } },
    env,
  );
  const body = (await res.json()) as {
    docs: { collection: string; id: string; data: Record<string, unknown> }[];
  };
  const doc = body.docs.find((d) => d.id === id && d.collection === "exams");
  assert.equal(doc?.data["title"], "Final exam");
  assert.equal("planId" in (doc?.data ?? {}), false);
});
