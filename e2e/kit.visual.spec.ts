import { expect, test } from "@playwright/test";

// One screenshot of the whole /kit gallery per theme, desktop 1280 (PLAN §13 Phase 2, S-39).
for (const theme of ["dark", "light"] as const) {
  test(`kit gallery, ${theme}`, async ({ page }) => {
    await page.goto("/kit");
    const gallery = page.locator('[data-ui="kit-gallery"]');
    if ((await gallery.getAttribute("data-theme")) !== theme) {
      await page.locator('[data-ui="theme-toggle"]').click();
    }
    await expect(gallery).toHaveAttribute("data-theme", theme);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`kit-${theme}.png`, { fullPage: true });
  });
}
