import { expect, test } from "./gate5.ts";
import { cmd } from "./helpers.ts";

// Library: open a set, Back to the list, Forward to the set. The set is made through the commands (no model involved).
const TITLE = `e2e library back ${Date.now()}`;

test("Library: open set, Back, Forward", async ({ page, api }) => {
  await cmd(api, "set.create", { title: TITLE }).then((r) =>
    cmd(api, "set.item_add", {
      set: (r["set"] as { id: string }).id,
      text: "Which vital sign is the pulse?\n* Heart rate\n- Body heat",
    }),
  );

  const list = page.getByRole("heading", { name: "Library", level: 1 });
  const set = page.getByRole("heading", { name: TITLE, level: 1 });
  await page.goto("/library");
  await expect(list).toBeVisible();
  await page.getByRole("radio", { name: /Sets/ }).click();
  await page.getByRole("button", { name: new RegExp(TITLE) }).click();
  await expect(set).toBeVisible();
  await expect(page).toHaveURL(/\/library\?open=/);

  await page.goBack();
  await expect(list).toBeVisible();
  await expect(page).not.toHaveURL(/open=/);

  await page.goForward();
  await expect(set).toBeVisible();
  await expect(page).toHaveURL(/\/library\?open=/);

  // A reload shows the same set.
  await page.reload();
  await expect(set).toBeVisible();
});
