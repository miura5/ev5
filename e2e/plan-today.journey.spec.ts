import { expect, test } from "./gate5.ts";
import { cmd } from "./helpers.ts";

// Far-off dates keep the journey off the synthetic record's real days.
const DAY = "2031-03-14";

test("Plan today: add, edit, delete and restore a plan item", async ({
  api,
}) => {
  const day = async (d: string) =>
    (await api("GET", `/api/v1/docs?collection=dayedits&id=${d}`)).body[
      "data"
    ] as {
      added?: Record<string, { text: string }>;
      checks?: Record<string, unknown>;
      skipped?: Record<string, unknown>;
    };

  const made = await cmd(api, "plan.create", {
    title: "e2e plan item",
    date: DAY,
  });
  const id = made["id"] as string;
  expect((await day(DAY)).added?.[id]?.text).toBe("e2e plan item");

  await cmd(api, "plan.update", { id, title: "e2e plan item (edited)" });
  expect((await day(DAY)).added?.[id]?.text).toBe("e2e plan item (edited)");

  expect((await cmd(api, "plan.toggle_done", { id }))["done"]).toBe(true);
  expect((await day(DAY)).checks).toHaveProperty(id);
  expect((await cmd(api, "plan.toggle_done", { id }))["done"]).toBe(false);

  // "Delete" is a move: the old day marks it skipped, the next day holds it (nothing is removed).
  const moved = await cmd(api, "plan.move_tomorrow", { id });
  expect(moved["date"]).toBe("2031-03-15");
  expect(await day(DAY)).toHaveProperty("skipped");
  expect((await day("2031-03-15")).added?.[id]?.text).toBe(
    "e2e plan item (edited)",
  );
  // Restore: move it back to the first day.
  await cmd(api, "plan.update", { id, date: DAY });
  expect((await day(DAY)).added?.[id]?.text).toBeTruthy();
});

test("Today: the tick is clicked in the browser and survives a reload", async ({
  page,
  api,
}) => {
  // Central date, as the app reads "today".
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(new Date());
  const title = `e2e tick ${Date.now()}`;
  await cmd(api, "plan.create", { title, date: today });

  await page.goto("/");
  await expect(page).toHaveURL(/\/today$/);
  const mark = page.getByRole("button", { name: `Mark done: ${title}` });
  await expect(mark).toHaveAttribute("aria-pressed", "false");
  await mark.click();
  await expect(
    page.getByRole("button", { name: `Mark not done: ${title}` }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(
    page.getByRole("button", { name: `Mark not done: ${title}` }),
  ).toHaveAttribute("aria-pressed", "true");
});
