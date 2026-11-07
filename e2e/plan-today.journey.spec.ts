import { expect, test } from "./gate5.ts";
import { cmd, parkPlanItem } from "./helpers.ts";

// Far-off dates keep the journey off the synthetic record's real days.
const DAY = "2031-03-14";

test("Plan today: add, edit, delete and restore a plan item", async ({
  api,
}) => {
  // The item's row (GET /plan-items/:id): its day, title and tick are columns.
  const row = async (id: string) =>
    (await api("GET", `/api/v1/plan-items/${id}`)).body as {
      day: string;
      title: string;
      done_at: number | null;
    };

  const made = await cmd(api, "plan.create", {
    title: "e2e plan item",
    date: DAY,
  });
  const id = made["id"] as string;
  try {
    expect((await row(id)).title).toBe("e2e plan item");
    expect((await row(id)).day).toBe(DAY);

    await cmd(api, "plan.update", { id, title: "e2e plan item (edited)" });
    expect((await row(id)).title).toBe("e2e plan item (edited)");

    expect((await cmd(api, "plan.toggle_done", { id }))["done"]).toBe(true);
    expect((await row(id)).done_at).not.toBeNull();
    expect((await cmd(api, "plan.toggle_done", { id }))["done"]).toBe(false);
    expect((await row(id)).done_at).toBeNull();

    // "Delete" is a move: the item goes to the next day (nothing is removed).
    const moved = await cmd(api, "plan.move_tomorrow", { id });
    expect(moved["date"]).toBe("2031-03-15");
    expect((await row(id)).day).toBe("2031-03-15");
    // Restore: move it back to the first day.
    await cmd(api, "plan.update", { id, date: DAY });
    expect((await row(id)).day).toBe(DAY);
  } finally {
    await parkPlanItem(api, id);
  }
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
  const id = (await cmd(api, "plan.create", { title, date: today }))[
    "id"
  ] as string;
  try {
    await page.goto("/");
    await expect(page).toHaveURL(/\/today$/);
    const mark = page.getByRole("button", {
      name: `Mark done: ${title}`,
      exact: true,
    });
    await expect(mark).toHaveAttribute("aria-pressed", "false");
    await mark.click();
    await expect(
      page.getByRole("button", {
        name: `Mark not done: ${title}`,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(
      page.getByRole("button", {
        name: `Mark not done: ${title}`,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  } finally {
    // Off Today, so a run leaves no "e2e tick" row for the user.
    await parkPlanItem(api, id);
  }
});
