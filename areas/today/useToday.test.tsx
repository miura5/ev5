import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useToday } from "./useToday.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status });

test("a tick reads the day, writes it whole pinned to its version, and retries once on a 409", async () => {
  localStorage.setItem("ev5.token", "t");
  const puts: string[] = [];
  let gets = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.push(`${url} ${init.body}`);
      return json({ version: 4 }, puts.length === 1 ? 409 : 200);
    }
    if (url.includes("collection=dayedits")) {
      gets++;
      return json({ id: "d", v: 2 + gets, data: { checks: {} } });
    }
    if (url.includes("jobs")) return json({ jobs: [] });
    return json({ docs: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useToday());
  await waitFor(() => expect(result.current.data).toBeTruthy());
  let ok = false;
  await act(async () => {
    ok = await result.current.tick("a", true);
  });
  expect(ok).toBe(true);
  expect(puts).toHaveLength(2);
  expect(puts[0]).toContain("if_version=4");
  expect(puts[1]).toContain("if_version=5");
  expect(puts[1]).toContain('"checks":{"a":');
});

test("a refused write is reported as not saved", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? json({ error: "no" }, 422)
        : url.includes("jobs")
          ? json({ jobs: [] })
          : url.includes("dayedits")
            ? json({}, 404)
            : json({ docs: [] }),
    ),
  );
  const { result } = renderHook(() => useToday());
  await waitFor(() => expect(result.current.data).toBeTruthy());
  let ok = true;
  await act(async () => {
    ok = await result.current.tick("a", true);
  });
  expect(ok).toBe(false);
});
