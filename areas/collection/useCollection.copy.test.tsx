import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useCollection } from "./useCollection.ts";

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
  "collection:/api/v1/collections": { collections: [] },
  "collection:/api/v1/memberships": { memberships: [] },
};
const ready = (s: { loaded: boolean }) => s.loaded;
const use = () => localStorage.setItem("ev5.token", "t");

test("offline, the saved copy shows and no error is raised", async () => {
  use();
  offline();
  const { result } = renderHook(() =>
    useCollection(undefined, fakeCopy(saved)),
  );
  await waitFor(() => expect(ready(result.current)).toBe(true));
  expect(result.current.error).toBeUndefined();
});

test("a server error shows the error and keeps the saved copy", async () => {
  use();
  status(503);
  const copy = fakeCopy(saved);
  const { result } = renderHook(() => useCollection(undefined, copy));
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
  const { result } = renderHook(() => useCollection(undefined, copy));
  await waitFor(() => expect(result.current.refused).toBe(true));
  expect(ready(result.current)).toBe(false);
  expect(copy.kept).toEqual(saved);
});

test("a good read refreshes the copy", async () => {
  use();
  ok({ collections: [], memberships: [], pins: [] });
  const copy = fakeCopy();
  const { result } = renderHook(() => useCollection(undefined, copy));
  await waitFor(() => expect(ready(result.current)).toBe(true));
  expect(Object.keys(copy.kept).sort()).toEqual([
    "collection:/api/v1/collections",
    "collection:/api/v1/memberships",
    "collection:/api/v1/pins",
  ]);
});
