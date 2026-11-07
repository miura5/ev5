import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useSessions } from "./useSessions.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const session = {
  id: "s1",
  v: 1,
  data: {
    schema: 2,
    writer: "page",
    at: "2026-11-04T15:00:00.000Z",
    source: "E.V. Home",
    date: "2026-11-04",
    topic: "Heart",
    status: "active",
    startedAt: new Date(Date.now() - 60_000).toISOString(),
  },
};

function setup(status: number) {
  localStorage.setItem("ev5.token", "t");
  const sent: { name: string; input: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("commands/")) {
        sent.push({
          name: url.slice(url.indexOf("commands/") + 9),
          input: JSON.parse(String(init.body)).input,
        });
        return {
          ok: status === 200,
          status,
          json: async () => ({ mode: "direct", result: {} }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ docs: [session] }) };
    }),
  );
  return sent;
}

test("an answer goes to check.answer with a fresh att_ id", async () => {
  const sent = setup(200);
  const { result } = renderHook(() => useSessions());
  await waitFor(() => expect(result.current.data?.id).toBe("s1"));
  await act(async () => {
    expect(await result.current.answer("my words")).toBe(true);
    await result.current.answer("again");
  });
  expect(sent[0]?.name).toBe("check.answer");
  expect(sent[0]?.input).toMatchObject({ id: "s1", answer: "my words" });
  const [a, b] = sent.map((s) => s.input.attempt as string);
  expect(a).toMatch(/^att_[0-9a-f]{32}$/);
  expect(a).not.toBe(b);
});

test("a refused answer (409) is told in a plain sentence", async () => {
  setup(409);
  const seen: (string | undefined)[] = [];
  const { result } = renderHook(() => {
    const s = useSessions();
    seen.push(s.error);
    return s;
  });
  await waitFor(() => expect(result.current.data?.id).toBe("s1"));
  await act(async () => {
    expect(await result.current.answer("x")).toBe(false);
  });
  expect(seen).toContain("That answer was already sent.");
});
