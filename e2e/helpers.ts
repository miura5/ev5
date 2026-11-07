// Command calls for the journeys: POST /api/v1/commands/:name as the app token, on staging's synthetic record only.
import { expect } from "./gate5.ts";

type Api = (
  method: string,
  path: string,
  body?: unknown,
) => Promise<{ status: number; body: Record<string, unknown> }>;

/** Runs a direct command and returns its result; any other status fails the journey with the command's name and error. */
export async function cmd(
  api: Api,
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  const r = await api("POST", `/api/v1/commands/${name}`, { input });
  expect(r.status, `${name}: ${JSON.stringify(r.body)}`).toBe(200);
  return r.body["result"] as Record<string, unknown>;
}

/** Reads a row list the way the screens do (GET /api/v1/<kind>, e.g. "goals" or "plan-items"): `{ rows }`, or the journey fails. */
export async function rows<T = Record<string, unknown>>(
  api: Api,
  kind: string,
): Promise<T[]> {
  const r = await api("GET", `/api/v1/${kind}`);
  expect(r.status, `${kind}: ${JSON.stringify(r.body)}`).toBe(200);
  return r.body["rows"] as T[];
}

/** Best-effort cleanup that never fails or hides the journey's own result: call it from a `finally`. */
export async function tolerate(step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch {
    // A cleanup that cannot run leaves the data; the journey's verdict is what matters.
  }
}

/**
 * Soft-deletes a document through the app's own delete path (sets `deleted_at` on the row, removes nothing, §delete.soft).
 * Documents and collections; sets have no delete command (§delete.who), so journeys reuse or restore those.
 */
export async function softDelete(api: Api, id: string): Promise<void> {
  await tolerate(() => cmd(api, "item.delete", { id }));
}

export const PARKED_DAY = "2031-12-31";

/** Parks a plan item on a day far from any real one, so Today never shows it (plan items have no delete command). */
export async function parkPlanItem(api: Api, id: string): Promise<void> {
  await tolerate(() => cmd(api, "plan.update", { id, date: PARKED_DAY }));
}
