import { expect, test } from "./gate5.ts";
import { rows } from "./helpers.ts";

// The exam is staging's seeded one (data/staging/seed.ts writes it through the commands).
const SEEDED_EXAM = "Synthetic exam";

test("Today opens and the staging record has the synthetic exam", async ({
  page,
  api,
}) => {
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "Today", level: 1 }),
  ).toBeVisible();
  const goals = await rows<{ title: string }>(api, "goals");
  expect(goals.map((g) => g.title)).toContain(SEEDED_EXAM);
});
