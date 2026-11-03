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
