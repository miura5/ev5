import { expect, test } from "./gate5.ts";

test("Notes: read once online, then offline a reload shows the shell, the saved copy notice and the notes list", async ({
  page,
  context,
  api,
}) => {
  const notes = await api("GET", "/api/v1/docs?collection=notes");
  expect((notes.body["docs"] as unknown[]).length).toBeGreaterThanOrEqual(1);

  const list = page.getByRole("region", { name: "Recent" });
  const row = list.locator(".ev-notes-line").first();

  // Online: the shell and the list load, and the page is then controlled by the service worker.
  await page.goto("/notes");
  await expect(
    page.getByRole("heading", { name: "Notes", level: 1 }),
  ).toBeVisible();
  await expect(row).toBeVisible();
  await expect(page.locator('[data-ui="saved-copy"]')).toHaveCount(0);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(row).toBeVisible();
  const title = (await row.innerText()).trim();

  // Offline: the reload still brings the shell, says it is a saved copy and lists the same notes.
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Notes", level: 1 }),
    ).toBeVisible();
    await expect(page.locator('[data-ui="saved-copy"]')).toContainText(
      "Saved copy",
    );
    await expect(row).toBeVisible();
    expect((await row.innerText()).trim()).toBe(title);
  } finally {
    await context.setOffline(false);
  }
});
