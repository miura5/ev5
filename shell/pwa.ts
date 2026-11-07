// Keeps the installed app on the newest build (CONTRACT §data.offline, §ui.targets). The generated worker takes over at
// once (registerType autoUpdate = skipWaiting + clientsClaim); the page re-checks it on window focus and every 10
// minutes, so a tab left open in the background also gets the new build. When the new
// worker takes over, the page reloads, but never while a study attempt is open: a takeover must not reset a study run.
import type { RegisterSWOptions } from "vite-plugin-pwa/types";

export type RegisterSW = (options?: RegisterSWOptions) => unknown;
type Win = Pick<Window, "addEventListener" | "setInterval">;

/** How often an open page asks for a new build, besides on focus. */
export const UPDATE_CHECK_MS = 10 * 60 * 1000;
type Reg = { update?: () => Promise<unknown> } | undefined;

/** Open attempts. A screen calls `hold()` when an attempt opens and the returned `release()` when it ends. */
export function createReloadHold(reload: () => void) {
  let open = 0;
  let pending = false;
  const settle = () => {
    if (open === 0 && pending) {
      pending = false;
      reload();
    }
  };
  return {
    hold(): () => void {
      open += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        open -= 1;
        settle();
      };
    },
    /** A new build is ready: reload now, or when the last attempt closes. */
    requestReload(): void {
      pending = true;
      settle();
    },
  };
}

export const reloadHold = createReloadHold(() => globalThis.location?.reload());

export function startPwa(
  register: RegisterSW,
  win: Win | undefined = globalThis.window,
  gate: Pick<typeof reloadHold, "requestReload"> = reloadHold,
): void {
  let reg: Reg;
  register({
    immediate: true,
    onNeedReload: () => gate.requestReload(),
    onRegisteredSW: (_url, r) => {
      reg = r;
    },
  });
  const check = () => void reg?.update?.().catch(() => undefined);
  win?.addEventListener("focus", check);
  win?.setInterval(check, UPDATE_CHECK_MS);
}
