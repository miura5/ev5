import { expect, test } from "./gate5.ts";

test("collections, memberships and deletions read (empty is fine)", async ({
  api,
}) => {
  for (const k of ["collections", "memberships", "deletions"]) {
    const r = await api("GET", `/api/v1/${k}`);
    expect(r.status, k).toBe(200);
    expect(Array.isArray(r.body[k]), k).toBe(true);
  }
});
