// Shared by the Gate 5 journey specs (*.journey.spec.ts): the staging token reaches the page the way the app reads it,
// and `api` calls /api/v1 as the app. A journey not built yet uses `test(name, notBuilt(why))`, which fails the test (never a skip).
import { test as base, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const TOKEN = process.env["E2E_TOKEN"] ?? "";

export const test = base.extend<{
  api: (
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<{ status: number; body: Record<string, unknown> }>;
}>({
  page: async ({ page }, use) => {
    await page.addInitScript(
      (t) => localStorage.setItem("ev5.token", t),
      TOKEN,
    );
    await use(page);
  },
  api: async ({ request }: { request: APIRequestContext }, use) => {
    await use(async (method, path, body) => {
      const res = await request.fetch(path, {
        method,
        headers: { authorization: `Bearer ${TOKEN}` },
        ...(body === undefined ? {} : { data: body }),
      });
      const parsed: unknown = await res.json().catch(() => ({}));
      return {
        status: res.status(),
        body:
          typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)
            : {},
      };
    });
  },
});

export { expect };

/** The body of a journey not built yet: it fails on purpose so the gate cannot pass while it is unbuilt. */
export const notBuilt = (why: string) => () => {
  throw new Error(`NOT BUILT (Gate 5 journey): ${why}`);
};
