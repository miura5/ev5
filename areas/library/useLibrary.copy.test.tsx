import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { failureSentence } from "../../commands/client.ts";
import { useLibrary } from "./useLibrary.ts";

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

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const saved = {
  "library:exams": [],
  "library:weakspots": [],
  "library:sets": [],
};

test("offline, the saved lists show and no error is raised", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("offline");
    }),
  );
  const { result } = renderHook(() => useLibrary(fakeCopy({ ...saved })));
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.error).toBeUndefined();
});

test("a server error shows the error and keeps the saved copy", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 503 })),
  );
  const copy = fakeCopy({ ...saved });
  const { result } = renderHook(() => useLibrary(copy));
  await waitFor(() =>
    expect(result.current.error).toBe(failureSentence("server")),
  );
  expect(result.current.data).toBeUndefined();
  expect(copy.kept["library:sets"]).toBe(saved["library:sets"]);
});

test("a 401 is not answered from the copy", async () => {
  localStorage.setItem("ev5.token", "t");
  const seen = vi.fn();
  window.addEventListener("ev5:unauthorized", seen);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 401 })),
  );
  const copy = fakeCopy({ ...saved });
  const { result } = renderHook(() => useLibrary(copy));
  await waitFor(() => expect(seen).toHaveBeenCalled());
  window.removeEventListener("ev5:unauthorized", seen);
  // the shell's token screen speaks for a refusal: no data, no sentence here
  expect(result.current.error).toBeUndefined();
  expect(result.current.data).toBeUndefined();
});

test("a good read refreshes the copy", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(JSON.stringify({ docs: [] }), { status: 200 }),
    ),
  );
  const copy = fakeCopy();
  const { result } = renderHook(() => useLibrary(copy));
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(Object.keys(copy.kept).sort()).toEqual([
    "library:exams",
    "library:sets",
    "library:weakspots",
  ]);
});
