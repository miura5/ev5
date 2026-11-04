// Registers the service worker that caches the app shell so it opens offline (CONTRACT §data.offline, §ui.targets).
export function registerPwa(nav: Pick<Navigator, "serviceWorker"> | undefined = globalThis.navigator): boolean {
  if (!nav || !("serviceWorker" in nav)) return false;
  void nav.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  return true;
}
