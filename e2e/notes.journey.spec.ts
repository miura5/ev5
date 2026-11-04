import { expect, test } from "./gate5.ts";

test("Notes opens; a document writes, updates, refuses a stale write and cannot be deleted", async ({
  page,
  api,
}) => {
  await page.goto("/notes");
  await expect(
    page.getByRole("heading", { name: "Notes", level: 1 }),
  ).toBeVisible();
  const notes = await api("GET", "/api/v1/docs?collection=notes");
  expect((notes.body["docs"] as unknown[]).length).toBeGreaterThanOrEqual(2);
  const at = `/api/v1/docs?collection=ideas&id=e2e-${Date.now()}`;
  expect((await api("PUT", at, { text: "e2e one" })).body["version"]).toBe(1);
  expect(
    (await api("PUT", `${at}&if_version=1`, { text: "e2e two" })).body[
      "version"
    ],
  ).toBe(2);
  expect(
    (await api("PUT", `${at}&if_version=1`, { text: "stale" })).status,
  ).toBe(409);
  expect((await api("GET", at)).body["data"]).toEqual({ text: "e2e two" });
  expect((await api("DELETE", "/api/v1/docs")).status).toBe(403);
});
