import { call } from "../commands/client.ts";
import { storedToken } from "./outbox/index.ts";
import type { OnToast } from "./useToasts.ts";

/** Run a registry command from ⌘K; a refusal shows "Not saved" with its plain reason (§ui.instant). */
export async function runPaletteCommand(
  name: string,
  show: OnToast,
): Promise<void> {
  const r = await call(name as Parameters<typeof call>[0], {}, storedToken());
  if (!r.ok) show(`Not saved: ${r.reason}`);
}
