import { expect, test } from "./gate5.ts";

test("Library opens, Exams and Sets tabs switch, a known exam reads back whole", async ({
  page,
  api,
}) => {
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Library", level: 1 }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Sets/ }).click();
  await page.getByRole("tab", { name: /Exams/ }).click();
  const one = await api(
    "GET",
    "/api/v1/docs?collection=exams&id=synthetic-exam",
  );
  expect(one.status).toBe(200);
  expect(one.body["id"]).toBe("synthetic-exam");
  expect((one.body["data"] as Record<string, unknown>)["course"]).toBe(
    "BIO 201",
  );
});
