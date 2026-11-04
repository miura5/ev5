import { expect, test } from "./gate5.ts";

test("Today opens and the staging record has the synthetic exam", async ({
  page,
  api,
}) => {
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "Today", level: 1 }),
  ).toBeVisible();
  const exams = await api("GET", "/api/v1/docs?collection=exams");
  expect(exams.status).toBe(200);
  expect(JSON.stringify(exams.body)).toContain("synthetic-exam");
  expect(
    (await api("GET", "/api/v1/docs?collection=dayedits&id=2000-01-01")).status,
  ).toBe(404);
});
