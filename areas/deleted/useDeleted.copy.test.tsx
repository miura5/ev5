import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useDeleted } from "./useDeleted.ts";

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

afterEach(async () => {
  // Vitest runs without globals, so Testing Library does not unmount for us: unmount, then let any read still in flight finish before the stubs and storage go.
  cleanup();
  await new Promise((r) => setTimeout(r, 0));
  vi.unstubAllGlobals();
  localStorage.clear();
});

const stub = (f: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(f));
const offline = () =>
  stub(async () => {
    throw new TypeError("offline");
  });
const status = (n: number) =>
  stub(async () => new Response("{}", { status: n }));
const ok = (body: unknown) =>
  stub(async () => new Response(JSON.stringify(body), { status: 200 }));
const saved: Record<string, unknown> = {
  "deleted:list": [{ collection: "sets", id: "a", at: Date.now() }],
};
const ready = (s: { items: unknown[] }) => s.items.length > 0;
const use = () => localStorage.setItem("ev5.token", "t");

test("offline, the saved copy shows and no error is raised", async () => {
  use();
  offline();
  const copy = fakeCopy(saved);
  const { result } = renderHook(() => useDeleted(copy));
  await waitFor(() => expect(ready(result.current)).toBe(true));
  expect(result.current.error).toBeUndefined();
});

test("a server error shows the error and keeps the saved copy", async () => {
  use();
  status(503);
  const copy = fakeCopy(saved);
  const { result } = renderHook(() => useDeleted(copy));
  await waitFor(() =>
    expect(result.current.error).toBe(
      "Something went wrong on E.V.'s side. Try again in a moment.",
    ),
  );
  expect(copy.kept).toEqual(saved);
});

test("a 401 is not answered from the copy", async () => {
  use();
  status(401);
  const copy = fakeCopy(saved);
  const { result } = renderHook(() => useDeleted(copy));
  await waitFor(() => expect(result.current.refused).toBe(true));
  expect(result.current.items).toEqual([]);
  expect(ready(result.current)).toBe(false);
  expect(copy.kept).toEqual(saved);
});

test("a good read refreshes the copy", async () => {
  use();
  ok({ deletions: [{ collection: "sets", id: "a", at: Date.now() }] });
  const copy = fakeCopy();
  const { result } = renderHook(() => useDeleted(copy));
  await waitFor(() => expect(ready(result.current)).toBe(true));
  expect(Object.keys(copy.kept).sort()).toEqual(["deleted:list"]);
});
