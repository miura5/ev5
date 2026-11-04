import { afterEach, expect, test, vi } from "vitest";
import { jobApi } from "./client.ts";

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
const stub = (f: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(f));
afterEach(() => vi.unstubAllGlobals());

test("list and get fall back to the saved copy offline", async () => {
  stub(async () => {
    throw new TypeError("offline");
  });
  const copy = fakeCopy({ jobs: [{ id: "j1" }], "job:j1": { id: "j1" } });
  expect(await jobApi.list("t", copy)).toEqual([{ id: "j1" }]);
  expect(await jobApi.get("j1", "t", copy)).toEqual({ id: "j1" });
});

test("a good read refreshes the copy", async () => {
  stub(async () => new Response(JSON.stringify({ jobs: [{ id: "j2" }] })));
  const copy = fakeCopy();
  expect(await jobApi.list("t", copy)).toEqual([{ id: "j2" }]);
  expect(copy.kept.jobs).toEqual([{ id: "j2" }]);
});

test("401 and 5xx throw with the status and keep the copy", async () => {
  for (const s of [401, 503]) {
    stub(async () => new Response("{}", { status: s }));
    const copy = fakeCopy({ jobs: [{ id: "old" }] });
    await expect(jobApi.list("t", copy)).rejects.toMatchObject({ status: s });
    expect(copy.kept.jobs).toEqual([{ id: "old" }]);
  }
});
