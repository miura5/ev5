// Registers the service worker that caches the app shell so it opens offline (CONTRACT §data.offline, §ui.targets).
// A new build must reach the open app: the browser re-checks /sw.js on every focus, and when the new worker takes
// over (autoUpdate = skipWaiting + clientsClaim) the page reloads once so it runs the new build (B-875).
type SwNav = Pick<Navigator, "serviceWorker">;
type Doc = Pick<Document, "addEventListener" | "visibilityState">;
type Reloader = () => void;

export function registerPwa(
  nav: SwNav | undefined = globalThis.navigator,
  doc: Doc | undefined = globalThis.document,
  reload: Reloader = () => globalThis.location?.reload(),
): boolean {
  if (!nav || !("serviceWorker" in nav)) return false;
  const sw = nav.serviceWorker;
  // Only a takeover of a page that already had a worker is an update; the first install must not reload.
  let hadController = Boolean(sw.controller);
  let reloaded = false;
  sw.addEventListener?.("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloaded) return;
    reloaded = true;
    reload();
  });
  void sw
    .register("/sw.js", { scope: "/" })
    .then((reg) => {
      doc?.addEventListener("visibilitychange", () => {
        if (doc.visibilityState === "visible") void reg?.update?.().catch(() => undefined);
      });
    })
    .catch(() => undefined);
  return true;
}
