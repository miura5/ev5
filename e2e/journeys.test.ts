import { test } from "node:test";
import assert from "node:assert/strict";
import { JOURNEYS, runAll } from "./journeys.ts";
import type { Call } from "./journeys.ts";

/** A tiny in-memory /api/v1 that behaves like the Worker for the routes the journeys use. */
function fake(): Call {
  const store = new Map<string, { v: number; data: unknown }>();
  const exam = { v: 1, data: { course: "BIO 201" } };
  return async (method, path, body) => {
    const u = new URL(path, "http://x");
    const c = u.searchParams.get("collection");
    const id = u.searchParams.get("id");
    if (method === "DELETE") return { status: 403, body: {} };
    if (path.startsWith("/api/v1/jobs"))
      return { status: 200, body: { jobs: [{ id: "j", state: "done" }] } };
    for (const k of ["collections", "memberships", "deletions"])
      if (u.pathname === `/api/v1/${k}`)
        return { status: 200, body: { [k]: [] } };
    if (method === "GET" && c && id === null) {
      const docs =
        c === "exams"
          ? [{ id: "synthetic-exam", ...exam }]
          : c === "notes"
            ? [{ id: "a" }, { id: "b" }]
            : [];
      return { status: 200, body: { docs } };
    }
    if (method === "GET" && c === "exams")
      return { status: 200, body: { id, ...exam } };
    if (method === "GET" && c && id) {
      const d = store.get(`${c}/${id}`);
      return d
        ? { status: 200, body: { id, ...d } }
        : { status: 404, body: {} };
    }
    if (method === "PUT" && c && id) {
      const key = `${c}/${id}`;
      const cur = store.get(key);
      const iv = u.searchParams.get("if_version");
      if (cur && Number(iv) !== cur.v) return { status: 409, body: {} };
      const v = (cur?.v ?? 0) + 1;
      store.set(key, { v, data: body });
      return { status: 200, body: { at: 1, version: v } };
    }
    return { status: 500, body: {} };
  };
}

test("every supported journey passes against a faithful fake", async () => {
  const res = await runAll(fake(), "t1");
  assert.deepEqual(
    res.filter((r) => r.state === "fail"),
    [],
  );
  assert.equal(
    res.filter((r) => r.state === "pass").length,
    JOURNEYS.filter((j) => !j.todo).length,
  );
});

test("todo journeys carry a reason and are never run", async () => {
  for (const j of JOURNEYS.filter((x) => x.todo !== undefined))
    assert.ok(j.todo && !j.run, j.name);
});

test("a failing journey is reported and the rest still run", async () => {
  const broken: Call = async () => ({ status: 500, body: {} });
  const res = await runAll(broken, "t2");
  assert.ok(res.some((r) => r.state === "fail" && /500/.test(r.note ?? "")));
  assert.equal(res.length, JOURNEYS.length);
});
