import { expect, test } from "./gate5.ts";

const REFUSED = "That token was not accepted. Paste the app token again.";

// Matt's first visit in a browser with no saved token: the token screen, a refused token, the right one, then Use a different token.
test("Token screen: no token, a wrong token, the right token, then Use a different token", async ({
  browser,
}) => {
  const right = process.env["E2E_TOKEN"] ?? "";
  expect(right, "E2E_TOKEN is set").not.toBe("");
  // A fresh context: the shared page fixture saves the token first, this journey must not.
  const context = await browser.newContext();
  const page = await context.newPage();
  const saved = () => page.evaluate(() => localStorage.getItem("ev5.token"));

  await page.goto("/today");
  const heading = page.getByRole("heading", {
    name: "Paste the app token",
    level: 1,
  });
  await expect(heading).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByText(REFUSED)).toHaveCount(0);

  await page.getByLabel("App token").fill("wrong-token-from-the-e2e-journey");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toHaveText(REFUSED);
  await expect(heading).toBeVisible();
  await expect(page.getByText(/unauthorized/i)).toHaveCount(0);

  await page.getByLabel("App token").fill(right);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Today", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(REFUSED)).toHaveCount(0);
  expect(await saved()).toBe(right);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Today", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Use a different token" }).click();
  await expect(heading).toBeVisible();
  await expect(page.getByText(REFUSED)).toHaveCount(0);
  expect(await saved()).toBeNull();
  await context.close();
});
