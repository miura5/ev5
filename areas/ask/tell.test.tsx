import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AskView } from "./Ask.view.tsx";
import { logTellMe, talkKey, withTellMe } from "./tellLog.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const now = new Date("2026-11-04T16:20:30Z");

test("a tap becomes one talk message, new day or not", () => {
  expect(talkKey(now, "Ab-1")).toBe("m-20261104-162030-pageab");
  const first = withTellMe(null, "m2", now, "ab");
  const later = new Date(now.getTime() + 5000);
  const next = withTellMe(first, "m4", later, "cd");
  expect(Object.keys(next.messages as object)).toHaveLength(2);
});

const res = (status: number, body: unknown = {}) => ({
  ok: status < 300,
  status,
  json: async () => body,
});

test("logTellMe creates today's document when there is none, and retries once on 409", async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(res(404))
    .mockResolvedValueOnce(res(409))
    .mockResolvedValueOnce(
      res(200, { v: 3, data: withTellMe(null, "m0", now, "zz") }),
    )
    .mockResolvedValueOnce(res(200));
  vi.stubGlobal("fetch", f);
  expect(await logTellMe("t", "m2", now, "ab")).toBe(true);
  const puts = f.mock.calls.filter((c) => c[1].method === "PUT");
  expect(puts[0]?.[0]).toContain("collection=talk&id=2026-11-04");
  expect(puts[0]?.[0]).not.toContain("if_version");
  expect(puts[1]?.[0]).toContain("if_version=3");
  expect(Object.keys(JSON.parse(puts[1]?.[1].body).messages)).toHaveLength(2);
});

test("logTellMe is false when the write is refused", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(500)),
  );
  expect(await logTellMe("t", "m2", now, "ab")).toBe(false);
});

test("the view hands the tap up with the turn's id", () => {
  const onJustTell = vi.fn();
  render(
    <AskView
      messages={[{ id: "m2", from: "ev", text: "Try first", asksTry: true }]}
      onSend={vi.fn()}
      onJustTell={onJustTell}
    />,
  );
  fireEvent.click(screen.getByText("Just tell me"));
  expect(onJustTell).toHaveBeenCalledWith("m2");
});
