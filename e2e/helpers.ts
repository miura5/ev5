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
