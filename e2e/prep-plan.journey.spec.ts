import { expect, test } from "./gate5.ts";
import { cmd } from "./helpers.ts";

// Prep plan: in Library > Dates, plan a date with E.V., ask for one change, approve, and read the plan back after a reload.
// This is the one journey that runs the model for real (a draft step and one change round, both Sonnet): it needs the
// Anthropic key on the staging Worker, and without it the plan job fails, so the journey fails with that said plainly.
// The date is a goal made by date.create, as Matt makes one (a `goal_` id, §data.tables), so the journey proves that a
// plan approved for a real date is the date's plan afterwards. Leftovers: dates, plans and jobs are never deleted
// (§delete.who), so the e2e date is made once and reused; each run adds one job and one approved `plans` document (its
// days are real dates before the date, so Today on staging's synthetic record shows them).
const OLD_EXAM = "e2e-plan-exam"; // the `exams` document this journey used before dates were goals
const TITLE = "e2e plan exam";
const WAIT_MS = 4 * 60_000;
const DAY_MS = 86_400_000;
const day = (ahead: number) =>
  new Date(Date.now() + ahead * DAY_MS).toISOString().slice(0, 10);

type Api = (
  method: string,
  path: string,
  body?: unknown,
) => Promise<{ status: number; body: Record<string, unknown> }>;

/** The older e2e `exams` document, if staging still has it, is marked done so Library lists one date by this title. */
async function retireOldExam(api: Api): Promise<void> {
  const at = `/api/v1/docs?collection=exams&id=${OLD_EXAM}`;
  const have = await api("GET", at);
  if (have.status === 404) return;
  expect(have.status).toBe(200);
  const data = have.body["data"] as Record<string, unknown>;
  if (data["status"] === "done") return;
  const put = await api("PUT", `${at}&if_version=${String(have.body["v"])}`, {
    ...data,
    at: new Date().toISOString(),
    status: "done",
  });
  expect(put.status, JSON.stringify(put.body)).toBe(200);
}

/** The e2e date as a goal, at least 3 days out so the plan has days to fill, of a kind that offers the prep plan: made
 * with date.create when missing, put right with date.update when too near or of another kind. Returns its id. */
async function ensureExam(api: Api): Promise<string> {
  await retireOldExam(api);
  const list = await api("GET", "/api/v1/docs?collection=exams");
  expect(list.status, JSON.stringify(list.body)).toBe(200);
  const have = (
    list.body["docs"] as { id: string; data: Record<string, unknown> }[]
  ).find(
    (d) =>
      d.id.startsWith("goal_") &&
      d.data["title"] === TITLE &&
      (d.data["status"] ?? "upcoming") === "upcoming",
  );
  if (!have) {
    const made = await cmd(api, "date.create", {
      title: TITLE,
      date: day(7),
      kind: "exam",
    });
    return made["id"] as string;
  }
  const date = have.data["date"];
  const dated = typeof date === "string" && date >= day(3);
  if (!dated || have.data["kind"] !== "exam")
    await cmd(api, "date.update", {
      id: have.id,
      kind: "exam",
      ...(dated ? {} : { date: day(7) }),
    });
  return have.id;
}

/** Polls the job until it reaches `want`; a failed job fails the journey with its own reason (a missing key reads here). */
async function waitFor(
  api: Api,
  id: string,
  want: "needs-you" | "done",
): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const r = await api("GET", `/api/v1/jobs/${id}`);
        const s = (r.body["status"] ?? {}) as {
          state?: string;
          reason?: string;
        };
        last = `${s.state ?? `HTTP ${r.status}`} ${s.reason ?? ""}`.trim();
        if (s.state === "failed")
          throw new Error(
            `The prep-plan job failed: ${s.reason ?? "no reason given"}. If this names the model or a key, ANTHROPIC_API_KEY is missing on the staging Worker.`,
          );
        return s.state;
      },
      {
        timeout: WAIT_MS,
        intervals: [2_000, 5_000, 10_000],
        message: `job ${id} never reached ${want}; last seen: ${last}`,
      },
    )
    .toBe(want);
}

test("Prep plan: plan with E.V., ask for a change, approve, it stays after a reload", async ({
  page,
  api,
}) => {
  test.setTimeout(3 * WAIT_MS);
  const exam = await ensureExam(api);

  const openExam = async () => {
    await page.goto("/library");
    await page.getByRole("radio", { name: /Dates/ }).click();
    await page.getByRole("button", { name: new RegExp(TITLE) }).click();
    await expect(page.getByText("Plan", { exact: true }).first()).toBeVisible();
  };

  // Plan with E.V.: the command starts the job; a start that fails (no key, no model) says why in the response.
  await openExam();
  const started = page.waitForResponse(
    (r) =>
      r.url().includes("/api/v1/commands/date.plan_with_ev") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Plan with E.V." }).click();
  const startRes = await started;
  const startBody = (await startRes.json().catch(() => ({}))) as {
    result?: { job?: { id?: string } };
    error?: string;
  };
  const jobId = startBody.result?.job?.id;
  expect(
    jobId,
    `Plan with E.V. did not start a job (HTTP ${startRes.status()}): ${startBody.error ?? "no reason"}. A missing ANTHROPIC_API_KEY on the staging Worker fails here.`,
  ).toBeTruthy();
  const id = jobId as string;

  // The draft is waiting: Library names it a draft and offers the three answers.
  await waitFor(api, id, "needs-you");
  await openExam();
  await expect(page.getByText("draft waiting for you")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Put away" })).toBeVisible();

  // One change round: the same job runs again and comes back waiting with a changed draft.
  await page.getByRole("button", { name: "Ask for changes" }).click();
  await page
    .getByLabel("What should change?")
    .fill("Make the first day lighter.");
  const asked = page.waitForResponse(
    (r) =>
      r.url().includes("/api/v1/commands/plan.ask_changes") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send changes" }).click();
  const askRes = await asked;
  expect(askRes.status(), await askRes.text()).toBe(200);
  await waitFor(api, id, "needs-you");
  await openExam();
  await expect(page.getByText("draft waiting for you")).toBeVisible();

  // Approve is one tap: it answers the waiting job, which saves the plan and puts it in force.
  const approved = page.waitForResponse(
    (r) =>
      /\/api\/v1\/jobs\/[^/]+\/continue$/.test(r.url()) &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const okRes = await approved;
  expect(okRes.status(), await okRes.text()).toBeLessThan(300);
  await waitFor(api, id, "done");

  // After a reload the exam reads the plan as in force, and its documents are all there.
  await openExam();
  await expect(page.getByText("in force")).toBeVisible();
  const date = await api("GET", `/api/v1/docs?collection=exams&id=${exam}`);
  expect(date.status, JSON.stringify(date.body)).toBe(200);
  const plan = await api("GET", `/api/v1/docs?collection=plans&id=plan-${id}`);
  expect(plan.status).toBe(200);
  const days = (plan.body["data"] as { days?: unknown[] }).days ?? [];
  expect(days.length).toBeGreaterThan(0);
});
