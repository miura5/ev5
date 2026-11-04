import { expect, notBuilt, test } from "./gate5.ts";

// Ask E.V. answers on a chat route (POST /api/v1/ask, server/ask-chat.ts; CONTRACT §job.no-chat-ask). The model call
// needs ANTHROPIC_API_KEY on the staging Worker. Without it the route answers 503 and the journey fails as NOT BUILT
// for that part only. The "a job is running" part is not driven: starting a job spends model money, so it is checked
// only as far as job_status's own list (GET /api/v1/jobs) that the reply is built from.

test('Ask "is it ready?" while a job runs', async ({ page, api }) => {
  const empty = await api("POST", "/api/v1/ask", { text: "   " });
  expect(empty.status).toBe(400);

  const jobs = await api("GET", "/api/v1/jobs");
  expect(jobs.status).toBe(200);
  expect(Array.isArray(jobs.body["jobs"])).toBe(true);

  await page.goto("/ask");
  await expect(
    page.getByRole("heading", { name: "Ask E.V.", level: 1 }),
  ).toBeVisible();

  const answered = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/ask") && r.request().method() === "POST",
  );
  const question = "Is it ready? Is my practice set done?";
  await page.getByRole("textbox", { name: "Message to E.V." }).fill(question);
  await page.keyboard.press("Enter");
  const res = await answered;

  const you = page.locator('[data-ui="ask-message"][data-from="you"]');
  await expect(you.last()).toContainText(question);
  const ev = page.locator('[data-ui="ask-message"][data-from="ev"]');

  if (res.status() === 503) {
    await expect(ev.last()).toContainText("ANTHROPIC_API_KEY is not set");
    notBuilt(
      "staging Worker has no ANTHROPIC_API_KEY, so a real Ask reply cannot be driven",
    )();
  }
  expect(res.status()).toBe(200);
  const reply = (
    (await res.json()) as {
      reply: { text: string; source?: string; unverified: boolean };
    }
  ).reply;
  expect(reply.text.length).toBeGreaterThan(0);
  // A reply shows either a checked source or the "Unverified:" mark, never neither (§ev.cites).
  if (reply.unverified) {
    expect(reply.source).toBeUndefined();
    await expect(ev.last()).toContainText(`Unverified: ${reply.text}`);
  } else {
    expect(reply.source).toBeTruthy();
    await expect(ev.last()).toContainText(reply.text);
    await expect(ev.last()).toContainText(reply.source ?? "");
  }
});
