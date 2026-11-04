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

/** Stands in for the shell's ReadCopy (areas never import the shell): a good read is kept; a rejected fetch gets it back. */
function fakeCopy(kept: Record<string, unknown> = {}) {
  return {
    kept,
    async read<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
      try {
        const v = await fetcher();
        kept[key] = v;
        return v;
      } catch (e) {
        if (!(e instanceof TypeError) || !(key in kept)) throw e;
        return kept[key] as T;
      }
    },
  };
}

const exam = { id: "e1", v: 1, at: 1, data: { title: "NUR 112 exam", date: "2099-01-01" } };

test("offline, Today shows the saved exams and weak spots", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
  const copy = fakeCopy({
    "today:exams": [exam],
    "today:weakspots": [],
    "today:dayedits:x": null,
  });
  // the day key moves with the date, so seed whatever date the hook asks for
  const read = copy.read;
  copy.read = (async (key: string, f: () => Promise<unknown>) =>
    key.startsWith("today:dayedits:") ? null : read(key, f)) as typeof copy.read;
  const { result } = renderHook(() => useToday(copy));
  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(result.current.error).toBeUndefined();
});

test("a 5xx shows the error, not the saved copy, and keeps the copy", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
  const saved = [exam];
  const copy = fakeCopy({ "today:exams": saved, "today:weakspots": [] });
  const { result } = renderHook(() => useToday(copy));
  await waitFor(() => expect(result.current.error).toBe("Today could not load."));
  expect(result.current.data).toBeUndefined();
  expect(copy.kept["today:exams"]).toBe(saved);
});
