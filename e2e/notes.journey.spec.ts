import { expect, test } from "./gate5.ts";
import { cmd, rows, softDelete } from "./helpers.ts";

test("Notes opens; a note saves, updates, refuses a stale save and reads back", async ({
  page,
  api,
}) => {
  await page.goto("/notes");
  await expect(
    page.getByRole("heading", { name: "Notes", level: 1 }),
  ).toBeVisible();
  expect((await rows(api, "notes")).length).toBeGreaterThanOrEqual(2);

  const id = (await cmd(api, "note.create", {}))["id"] as string;
  try {
    const one = await cmd(api, "note.save", { id, body: "e2e one" });
    const two = await cmd(api, "note.save", {
      id,
      body: "e2e two",
      if_version: one["version"] as number,
    });
    expect(two["version"]).toBe((one["version"] as number) + 1);
    const stale = await api("POST", "/api/v1/commands/note.save", {
      input: { id, body: "stale", if_version: one["version"] },
    });
    expect(stale.status).toBe(409);
    const read = await api("GET", `/api/v1/notes/${id}`);
    expect(read.status).toBe(200);
    expect(read.body["text"]).toContain("e2e two");
  } finally {
    await softDelete(api, id);
  }
});
