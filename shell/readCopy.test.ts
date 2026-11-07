import { expect, test } from "vitest";
import { savedFirst } from "../commands/client.ts";
import { createReadCopy } from "./readCopy.ts";
import { memoryCopyStore } from "./readCopy.testkit.ts";

const offline = async (): Promise<never> => {
  throw new TypeError("offline");
};

test("a read stores its answer; a failing read gives the stored copy and says so", async () => {
  const c = createReadCopy(memoryCopyStore());
  expect(await c.read("notes", async () => [1])).toEqual([1]);
  expect(c.usingCopy()).toBe(false);
  expect(await c.read("notes", offline)).toEqual([1]);
  expect(c.usingCopy()).toBe(true);
});

test("a fresh read replaces the copy and clears the notice", async () => {
  const c = createReadCopy(memoryCopyStore());
  await c.read("notes", async () => [1]);
  await c.read("notes", async () => [2]);
  expect(await c.read("notes", offline)).toEqual([2]);
  let n = 0;
  c.subscribe(() => n++);
  await c.read("notes", async () => [3]);
  expect(c.usingCopy()).toBe(false);
  expect(n).toBe(1);
});

test("with no copy, or on a refusal, the failure shows as it is", async () => {
  const c = createReadCopy(memoryCopyStore());
  await expect(c.read("notes", offline)).rejects.toThrow("offline");
  await c.read("notes", async () => [1]);
  await expect(
    c.read("notes", async () => {
      throw new Error("That token was not accepted.");
    }),
  ).rejects.toThrow("token");
  expect(c.usingCopy()).toBe(false);
});

test("the saved reader answers from the last good read without the server, and says when a key had none", async () => {
  const store = memoryCopyStore();
  const c = createReadCopy(store);
  await c.read("notes", async () => [1]);
  const s = c.saved();
  let asked = 0;
  const server = async () => (asked++, [9]);
  expect(await s.read("notes", server)).toEqual([1]);
  expect(s.missed()).toBe(false);
  await expect(s.read("exams", server)).rejects.toThrow();
  expect(s.missed()).toBe(true);
  expect(asked).toBe(0);
  // After a reload the kept answers come from the store, and the notice stays off.
  const again = createReadCopy(store).saved();
  expect(await again.read("notes", server)).toEqual([1]);
  expect(c.usingCopy()).toBe(false);
});

test("savedFirst paints the saved answer, then the server's; a refusal takes the saved one down", async () => {
  const c = createReadCopy(memoryCopyStore());
  await c.read("k", async () => "old");
  const shown: string[] = [];
  let answer!: (v: string) => void;
  const server = new Promise<string>((r) => (answer = r));
  const done = savedFirst(
    c,
    true,
    (r) => r!.read("k", () => server),
    (v) => shown.push(v),
  );
  await new Promise((r) => setTimeout(r, 0));
  expect(shown).toEqual(["old"]);
  answer("new");
  await done;
  expect(shown).toEqual(["old", "new"]);

  let down = 0;
  await expect(
    savedFirst(
      c,
      true,
      async (r) => {
        const v = await r!.read("k", async () => {
          await new Promise((t) => setTimeout(t, 5));
          throw new Error("That token was not accepted.");
        });
        return v;
      },
      (v) => shown.push(v),
      () => down++,
    ),
  ).rejects.toThrow("token");
  expect(down).toBe(1);
  // Without warm (a re-read after a change), only the server's answer shows.
  shown.length = 0;
  await savedFirst(c, false, (r) => r!.read("k", async () => "newer"), (v) => shown.push(v));
  expect(shown).toEqual(["newer"]);
});
