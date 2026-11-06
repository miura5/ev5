import { expect, test } from "./gate5.ts";

// The date is staging's seeded exam (data/staging/seed.ts writes it through the commands).
const SEEDED_EXAM = "Synthetic exam";

test("Library opens, Dates and Sets tabs switch, a known date reads back whole", async ({
  page,
  api,
}) => {
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Library", level: 1 }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Sets/ }).click();
  await page.getByRole("radio", { name: /Dates/ }).click();
  const all = await api("GET", "/api/v1/docs?collection=exams");
  const seeded = (
    all.body["docs"] as { id: string; data: { title?: string } }[]
  ).find((d) => d.data.title === SEEDED_EXAM);
  expect(seeded, "the seeded exam").toBeTruthy();
  const one = await api(
    "GET",
    `/api/v1/docs?collection=exams&id=${seeded?.id ?? ""}`,
  );
  expect(one.status).toBe(200);
  expect(one.body["id"]).toBe(seeded?.id);
  expect((one.body["data"] as Record<string, unknown>)["kind"]).toBe("exam");
});
