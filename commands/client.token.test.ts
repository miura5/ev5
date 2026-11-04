import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, call, failureSentence, forgetToken, readToken, saveToken, UNAUTHORIZED_EVENT } from "./client.ts";

let seen = 0;
const on = () => seen++;
beforeEach(() => {
  seen = 0;
  window.addEventListener(UNAUTHORIZED_EVENT, on);
});
afterEach(() => {
  window.removeEventListener(UNAUTHORIZED_EVENT, on);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  forgetToken();
});

test("save, read and forget the token", () => {
  expect(readToken()).toBe("");
  saveToken("a");
  expect(readToken()).toBe("a");
  saveToken("b");
  expect(localStorage.getItem("ev5.token")).toBe("b");
  forgetToken();
  expect(readToken()).toBe("");
});

test("blocked storage: the token lasts this visit only", () => {
  const boom = () => {
    throw new Error("blocked");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
  saveToken("v");
  expect(readToken()).toBe("v");
  forgetToken();
  expect(readToken()).toBe("");
});

test("a 401 signals once per call and keeps the token; 403 and 5xx do not signal", async () => {
  saveToken("keep");
  for (const [status, n] of [[401, 1], [401, 2], [403, 2], [500, 2], [503, 2]] as const) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));
    await api("jobs", "keep");
    expect(seen).toBe(n);
  }
  expect(readToken()).toBe("keep");
});

test("plain sentences by kind, never the server's text", () => {
  const refused = failureSentence({ status: 401 });
  const offline = failureSentence(new TypeError("Failed to fetch"));
  const server = failureSentence({ status: 503 });
  expect(new Set([refused, offline, server]).size).toBe(3);
  expect(refused).toMatch(/token/);
  expect(offline).toMatch(/connection/);
  expect(server).toMatch(/went wrong/);
  expect(failureSentence(401)).toBe(refused);
  expect(failureSentence("offline")).toBe(offline);
  for (const s of [refused, offline, server]) expect(s).not.toMatch(/unauthorized/i);
});

test("call(): no token, a wrong token and a server error give plain sentences, never server text", async () => {
  const cases: [number, string][] = [[401, "unauthorized"], [401, "missing bearer token"], [500, "D1_ERROR: no such table: docs"], [503, "D1_ERROR: x"]];
  for (const [status, error] of cases) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error }), { status })));
    const r = await call("item.pin", {}, status === 401 && error === "missing bearer token" ? "" : "bad");
    expect(r).toEqual({ ok: false, status, reason: failureSentence(status) });
    if (!r.ok) expect(r.reason).not.toMatch(/unauthorized|bearer|D1_|\d{3}/i);
  }
  expect(seen).toBe(2);
});

test("call(): a lost connection is a plain sentence with status 0", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
  expect(await call("item.pin", {}, "t")).toEqual({ ok: false, status: 0, reason: failureSentence(new TypeError("x")) });
});
