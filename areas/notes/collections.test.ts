import { afterEach, expect, test, vi } from "vitest";
import { readCollections } from "./collections.ts";

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

const keptCols = {
  "notes:collections": { collections: [{ id: "c1", title: "NUR 112" }] },
  "notes:memberships": { memberships: [{ collection: "notes", id: "n1", collectionId: "c1" }] },
};

test("offline, the saved collections and filing show", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
  const r = await readCollections(fakeCopy({ ...keptCols }));
  expect(r.collections.map((c) => c.title)).toEqual(["NUR 112"]);
  expect(r.members.get("n1")).toBe("c1");
});

test("a 5xx shows none and does not overwrite the saved copy", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
  const copy = fakeCopy({ ...keptCols });
  const r = await readCollections(copy);
  expect(r.collections).toEqual([]);
  expect(copy.kept["notes:collections"]).toEqual(keptCols["notes:collections"]);
});

test("without a copy, a good read works as before", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(keptCols["notes:collections"]), { status: 200 })));
  expect((await readCollections()).collections).toHaveLength(1);
});
