import { expect, test } from "vitest";
import { createReadCopy, memoryCopyStore } from "./readCopy.ts";

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
