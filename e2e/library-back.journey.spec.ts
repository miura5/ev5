import { expect, test } from "./gate5.ts";

// Library: open a set, Back to the list, Forward to the set. The set is the practice-set journey's, written straight
// to the `sets` collection under a fixed id (no model involved); sets never change and nothing is deleted (§delete.who).
const SET = "e2e-library-back-set";
const TITLE = "e2e library back set";

test("Library: open set, Back, Forward", async ({ page, api }) => {
  const have = await api("GET", `/api/v1/docs?collection=sets&id=${SET}`);
  if (have.status === 404) {
    const put = await api("PUT", `/api/v1/docs?collection=sets&id=${SET}`, {
      schema: 3,
      writer: "page",
      at: "2026-11-06T12:00:00Z",
      source: "e2e",
      kind: "drill",
      title: TITLE,
      items: [
        {
          id: "q1",
          type: "single",
          stem: "Which vital sign is the pulse?",
          options: ["Heart rate", "Body heat"],
          correct: [0],
        },
      ],
    });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
  } else expect(have.status).toBe(200);

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
