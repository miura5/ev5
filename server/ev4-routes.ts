/** ev4's /api routes. v5 answers each with 410 Gone at cutover (data/compat/routes.json lists them). */
const EV4_ROUTES: RegExp[] = [
  /^\/api\/db(\/[^/]+\/[^/]+)?$/,
  /^\/api\/run(\/.*)?$/,
  /^\/api\/images(\/.+)?$/,
  /^\/api\/backup\/(export|newest|get)$/,
  /^\/api\/claude(\/(usage|limits))?$/,
  /^\/api\/jobs\/[^/]+\/run$/,
];

export function isEv4Route(path: string): boolean {
  return EV4_ROUTES.some((r) => r.test(path));
}

/** The files ev4's page boots from and its service worker caches (the worker's own /sw.js and the manifest are replaced in place by v5's). */
const EV4_PAGE_FILES = new Set(["/bridge.js", "/app.js", "/core.js", "/spec.json", "/styles.css"]);

export function isEv4PageFile(path: string): boolean {
  return EV4_PAGE_FILES.has(path);
}

/** What an old ev4 page or API caller reads when it reaches v5. */
export const MOVED_TEXT = "E.V. has moved, reload";
