import { expect, test } from "./gate5.ts";

test("Activity opens and the jobs list reads", async ({ page, api }) => {
  await page.goto("/activity");
  await expect(
    page.getByRole("heading", { name: "Activity", level: 1 }),
  ).toBeVisible();
  expect((await api("GET", "/api/v1/jobs")).status).toBe(200);
});
