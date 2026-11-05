// Runs inside v5's service worker, which replaces ev4's worker at the same /sw.js URL. When it finds ev4's
// caches it deletes them and reloads the open pages once, so a browser that still has ev4's page installed
// lands on v5 (CONTRACT §data.ev4-routes).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const old = names.filter((n) => n === "ev-page" || n.startsWith("ev-shell"));
      if (old.length === 0) return;
      await Promise.all(old.map((n) => caches.delete(n)));
      const open = await self.clients.matchAll({ type: "window" });
      await Promise.all(open.map((c) => c.navigate(c.url).catch(() => null)));
    })(),
  );
});
