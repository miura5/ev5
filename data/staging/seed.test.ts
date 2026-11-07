import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEED, seed } from "./seed.ts";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const TOKEN = "t-not-real";

interface Call {
  method: string;
  path: string;
  auth: string | undefined;
  body: { input?: Record<string, unknown> } | undefined;
}

/** A fake Worker: answers the two reads with `record`, each command with a plausible result, or `fail` with a 400. */
function fakeWorker(record: { notes?: unknown[]; goals?: unknown[] }, fail?: string) {
  const calls: Call[] = [];
  let n = 0;
  const fetch = async (
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ) => {
    const path = url.replace("https://staging.example", "");
    const body = init.body ? (JSON.parse(init.body) as Call["body"]) : undefined;
    calls.push({ method: init.method, path, auth: init.headers["authorization"], body });
    const name = path.replace("/api/v1/commands/", "");
    const result: Record<string, unknown> =
      name === "collection.create"
        ? { collection: { id: "col_1" } }
        : name === "note.create"
          ? { id: `n-${++n}` }
          : name === "note.save"
            ? { version: 2 }
            : name === "set.create"
              ? { set: { id: "set_1" } }
              : {};
    const answer =
      path === "/api/v1/notes"
        ? { rows: record.notes ?? [] }
        : path === "/api/v1/goals"
          ? { rows: record.goals ?? [] }
          : { mode: "direct", result };
    const status = name === fail ? 400 : 200;
    return { status, text: async () => JSON.stringify(status === 200 ? answer : { error: "no" }) };
  };
  return { calls, fetch, s: { url: "https://staging.example", token: TOKEN, fetch, now: NOW } };
}

const commands = (calls: Call[]) =>
  calls.filter((c) => c.method === "POST").map((c) => c.path.replace("/api/v1/commands/", ""));

test("an empty record is seeded through commands only, as the app token", async () => {
  const w = fakeWorker({});
  assert.equal(await seed(w.s), true);
  assert.deepEqual(commands(w.calls), [
    "collection.create",
    "note.create", "note.save", "item.rename",
    "note.create", "note.save", "item.rename",
    "date.create", "date.create",
    "set.create", "set.item_add", "set.item_add",
  ]);
  for (const c of w.calls) assert.equal(c.auth, `Bearer ${TOKEN}`);
  // Reads are GETs; every write is a command POST (§data.gate).
  assert.ok(w.calls.every((c) => c.method === "POST" ? c.path.startsWith("/api/v1/commands/") : c.method === "GET"));
});

test("the seed's inputs: one date of each kind ahead of today, the set and a note in the collection", async () => {
  const w = fakeWorker({});
  await seed(w.s);
  const input = (name: string) =>
    w.calls.filter((c) => c.path.endsWith(`/${name}`)).map((c) => c.body?.input);
  assert.deepEqual(input("date.create"), [
    { title: SEED.exam, date: "2026-11-27", kind: "exam" },
    { title: SEED.other, date: "2026-11-16", kind: "other" },
  ]);
  assert.deepEqual(input("note.create"), [{ collection: "col_1" }, {}]);
  assert.deepEqual(input("set.create"), [{ title: SEED.set, collection: "col_1" }]);
  assert.deepEqual(input("item.rename").map((i) => i?.["title"]), [...SEED.notes]);
  for (const i of input("set.item_add")) assert.equal(i?.["set"], "set_1");
});

test("a record with notes, or with the seeded exam, is left alone", async () => {
  for (const record of [
    { notes: [{ id: "n-1" }] },
    { goals: [{ id: "goal_1", title: SEED.exam }] },
  ]) {
    const w = fakeWorker(record);
    assert.equal(await seed(w.s), false);
    assert.deepEqual(commands(w.calls), []);
  }
});

test("another date does not stop the seed; a refused command stops it loudly", async () => {
  const w = fakeWorker({ goals: [{ id: "goal_9", title: "Some other date" }] });
  assert.equal(await seed(w.s), true);
  await assert.rejects(seed(fakeWorker({}, "date.create").s), /date\.create: 400/);
});

test("the seeded data is synthetic: no course code or name in any title", () => {
  for (const t of [SEED.collection, ...SEED.notes, SEED.exam, SEED.other, SEED.set])
    assert.match(t, /^Synthetic /);
});

test("the Gate 5 journeys that read the seeded exam name it by the seed's title", () => {
  for (const f of ["today", "library"])
    assert.ok(
      readFileSync(new URL(`../../e2e/${f}.journey.spec.ts`, import.meta.url), "utf8").includes(SEED.exam),
      `e2e/${f}.journey.spec.ts`,
    );
});
