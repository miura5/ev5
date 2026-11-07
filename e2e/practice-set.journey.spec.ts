import { expect, test } from "./gate5.ts";
import { cmd, rows } from "./helpers.ts";

type Api = Parameters<typeof cmd>[0];

// Practice set: open a set from Library, study it in the browser, answer, reveal, rate, leave, and read the attempt back.
// The set is made with the set commands (set.create, set.item_add), so no model and no ANTHROPIC_API_KEY is involved. The
// model-written variant (the job that writes a set) is covered by gate4-e2e.yml.
// Leftovers: a set has no delete command (§delete.who), so the set is found by its title and reused every run; each run adds
// one append-only `attempts` row, which has no delete path and stays on staging's synthetic record.
const TITLE = "e2e practice set";
const QUESTIONS = [
  {
    stem: "Which vital sign is the pulse?",
    text: "Which vital sign is the pulse?\n* Heart rate\n- Body heat",
  },
  {
    stem: "Which vital sign is the temperature?",
    text: "Which vital sign is the temperature?\n* Body heat\n- Heart rate",
  },
];

/** The e2e set's id and its first item: made (or topped up) with the set commands when missing. */
async function ensureSet(api: Api): Promise<{ set: string; q1: string }> {
  let set = (await rows<{ id: string; title: string }>(api, "sets")).find(
    (s) => s.title === TITLE,
  )?.id;
  if (!set) {
    const made = await cmd(api, "set.create", { title: TITLE });
    set = (made["set"] as { id: string }).id;
  }
  const items = async () =>
    (await rows<{ id: string; set_id: string; pos: number }>(api, "items"))
      .filter((i) => i.set_id === set)
      .sort((x, y) => x.pos - y.pos);
  for (const q of QUESTIONS.slice((await items()).length))
    await cmd(api, "set.item_add", { set, text: q.text });
  return { set, q1: (await items())[0]?.id ?? "" };
}

test("Practice set: open it, answer, reveal, leave, attempt reads back", async ({
  page,
  api,
}) => {
  const { set, q1 } = await ensureSet(api);

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

  // The rating went through the outbox: it lands as an `attempts` row of this set's first question, with the attempt text,
  // kept as a self-rating (Good) and never a score, so it stays out of accuracy.
  await expect
    .poll(
      async () =>
        (
          await rows<{
            set_id: string;
            item_id: string;
            how: string;
            score: number | null;
            answer: { text?: string; rating?: string } | null;
          }>(api, "attempts")
        ).some(
          (a) =>
            a.set_id === set &&
            a.item_id === q1 &&
            a.how === "self" &&
            a.score === null &&
            a.answer?.text === attempt &&
            a.answer?.rating === "good",
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
});
