import { expect, test } from "./gate5.ts";

// Practice set: open a set from Library, study it in the browser, answer, reveal, rate, leave, and read the attempt back.
// The set is written straight to the `sets` collection (ev4 schema 3) under one fixed id, so no model and no
// ANTHROPIC_API_KEY is involved. The model-written variant (the job that writes a set) is covered by gate4-e2e.yml.
// Leftovers: sets items never change and nothing is deleted (§delete.who), so the set is reused every run; each run
// adds one append-only `answers` document, which has no delete path and stays on staging's synthetic record.
const SET = "e2e-practice-set";
const TITLE = "e2e practice set";
const AT = "2026-11-04T12:00:00Z";
const QUESTIONS = [
  {
    id: "q1",
    type: "single",
    stem: "Which vital sign is the pulse?",
    options: ["Heart rate", "Body heat"],
    correct: [0],
  },
  {
    id: "q2",
    type: "single",
    stem: "Which vital sign is the temperature?",
    options: ["Body heat", "Heart rate"],
    correct: [0],
  },
];

test("Practice set: open it, answer, reveal, leave, attempt reads back", async ({
  page,
  api,
}) => {
  const have = await api("GET", `/api/v1/docs?collection=sets&id=${SET}`);
  if (have.status === 404) {
    const put = await api("PUT", `/api/v1/docs?collection=sets&id=${SET}`, {
      schema: 3,
      writer: "page",
      at: AT,
      source: "e2e",
      kind: "drill",
      title: TITLE,
      items: QUESTIONS,
    });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
  } else expect(have.status).toBe(200);

  await page.goto("/library");
  await page.getByRole("radio", { name: /Sets/ }).click();
  await page.getByRole("button", { name: new RegExp(TITLE) }).click();
  await expect(
    page.getByRole("heading", { name: TITLE, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(QUESTIONS[0]!.stem).first()).toBeVisible();

  await page.getByRole("button", { name: "Study", exact: true }).click();
  await expect(page.getByText("1 of 2")).toBeVisible();
  await expect(page.getByText(QUESTIONS[0]!.stem)).toBeVisible();

  const attempt = `e2e attempt ${Date.now()}`;
  await page.getByLabel("Your answer").fill(attempt);
  await page.getByRole("button", { name: /Turn over/ }).click();
  await expect(page.getByText(`You wrote: ${attempt}`)).toBeVisible();
  await expect(page.getByText("Heart rate")).toBeVisible();
  await page.getByRole("button", { name: /Good/ }).click();

  await expect(page.getByText("2 of 2")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`← ${TITLE}`) }).click();
  await expect(
    page.getByRole("heading", { name: TITLE, level: 1 }),
  ).toBeVisible();

  // The rating went through the outbox: it lands as an `answers` document of this set, with the attempt text.
  await expect
    .poll(
      async () => {
        const r = await api("GET", "/api/v1/docs?collection=answers");
        const docs = (r.body["docs"] ?? []) as { data: unknown }[];
        return docs.some((d) => {
          const x = d.data as {
            setId?: string;
            answers?: Record<string, Record<string, unknown>>;
          };
          return (
            x.setId === SET &&
            Object.values(x.answers?.["q1"] ?? {}).some(
              (a) =>
                (a as { text?: string; correct?: boolean }).text === attempt &&
                (a as { correct?: boolean }).correct === true,
            )
          );
        });
      },
      { timeout: 20_000 },
    )
    .toBe(true);
});
