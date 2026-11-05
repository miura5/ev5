import { failureSentence } from "../../commands/client.ts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useToday } from "./useToday.ts";

afterEach(() => {
  vi.restoreAllMocks();
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

const exam = {
  id: "e1",
  v: 1,
  at: 1,
  data: { title: "NUR 112 exam", date: "2099-01-01" },
};

test("offline, Today shows the saved exams and weak spots", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("offline");
    }),
  );
  const copy = fakeCopy({
    "today:exams": [exam],
    "today:weakspots": [],
    "today:dayedits:x": null,
  });
  // the day key moves with the date, so seed whatever date the hook asks for
  const read = copy.read;
  copy.read = (async (key: string, f: () => Promise<unknown>) =>
    key.startsWith("today:dayedits:")
      ? null
      : read(key, f)) as typeof copy.read;
  const { result } = renderHook(() => useToday(copy));
  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(result.current.error).toBeUndefined();
});

test("a 5xx shows the error, not the saved copy, and keeps the copy", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({}, 503)),
  );
  const saved = [exam];
  const copy = fakeCopy({ "today:exams": saved, "today:weakspots": [] });
  const { result } = renderHook(() => useToday(copy));
  await waitFor(() =>
    expect(result.current.error).toBe(failureSentence("server")),
  );
  expect(result.current.data).toBeUndefined();
  expect(copy.kept["today:exams"]).toBe(saved);
});

test("a 401 shows no data and no sentence, and tells the shell", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({}, 401)),
  );
  const seen = vi.fn();
  window.addEventListener("ev5:unauthorized", seen);
  const { result } = renderHook(() => useToday());
  await waitFor(() => expect(seen).toHaveBeenCalled());
  window.removeEventListener("ev5:unauthorized", seen);
  expect(result.current.error).toBeUndefined();
  expect(result.current.data).toBeUndefined();
});

/** Catches the poll's timer so a test fires it at once (waitFor needs the real clock). */
function pollTicks() {
  const fns: (() => void)[] = [];
  const real = globalThis.setInterval;
  vi.spyOn(globalThis, "setInterval").mockImplementation(((
    f: () => void,
    ms?: number,
  ) => {
    if (ms === 10_000) {
      fns.push(f);
      return 0 as never;
    }
    return real(f, ms);
  }) as never);
  return { fire: () => fns.forEach((f) => f()) };
}

test("Today follows a plan job that changes while it is open", async () => {
  const ticks = pollTicks();
  localStorage.setItem("ev5.token", "t");
  let jobs: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("jobs")
        ? json({ jobs })
        : url.includes("dayedits")
          ? json({}, 404)
          : json({ docs: [] }),
    ),
  );
  const { result } = renderHook(() => useToday());
  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(result.current.planWaiting).toBe(false);
  jobs = [
    {
      id: "j1",
      kind: "study-plan",
      state: "needs-you",
      examId: "x1",
      summary: "",
    },
  ];
  await act(async () => {
    ticks.fire();
  });
  await waitFor(() => expect(result.current.planWaiting).toBe(true));
});

test("Today sends every read at once, and a second visit opens on the saved answer before the server's (§ui.instant)", async () => {
  localStorage.setItem("ev5.token", "t");
  // The shell's read copy (shell/readCopy.ts), kept small here: areas never import the shell.
  const kept = new Map<string, unknown>();
  const copy = {
    read: async <T,>(k: string, get: () => Promise<T>) => {
      const v = await get();
      kept.set(k, v);
      return v;
    },
    saved: () => {
      let missed = false;
      return {
        read: async <T,>(k: string) => {
          if (!kept.has(k)) {
            missed = true;
            throw new TypeError(k);
          }
          return structuredClone(kept.get(k)) as T;
        },
        missed: () => missed,
      };
    },
  };
  const pending: ((r: Response) => void)[] = [];
  const answer = (url: string) =>
    url.includes("jobs")
      ? json({ jobs: [] })
      : url.includes("dayedits")
        ? json({}, 404)
        : json({ docs: [] });
  // The server holds every answer until all six reads have gone out.
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string) =>
        new Promise<Response>((r) => pending.push(() => r(answer(url)))),
    ),
  );
  const first = renderHook(() => useToday(copy));
  await waitFor(() => expect(pending).toHaveLength(6));
  pending.forEach((go) => go(new Response()));
  await waitFor(() => expect(first.result.current.data).toBeTruthy());
  const seen = first.result.current.data;
  first.unmount();

  // Second visit: the server never answers, yet the screen has its data.
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
  const second = renderHook(() => useToday(copy));
  await waitFor(() => expect(second.result.current.data).toEqual(seen));
});
