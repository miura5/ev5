// /api/v1 row reads, one pair per kind (CONTRACT §data.tables, §data.gate): the row as the domain shape returns it, so
// an area can read a goal, an objective or a weak spot without the wire document. Read through the tables gate; a row
// the gate cannot parse is left out and counted in `left_out` (read-report.ts). Auth is applied by index.ts.
//   GET /goals              every live goal, in date order     GET /goals/:id
//   GET /objectives         every live objective               GET /objectives/:id
//   GET /weak-spots         every live weak spot               GET /weak-spots/:id
// The older /docs?collection=… reads stay until the areas have moved.
import { Hono } from "hono";
import type { Context } from "hono";
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import type { AuthVars } from "./auth.ts";
import { leftOutField, readReport, requestIdOf } from "./read-report.ts";

type Ctx = { Bindings: { DB: DocsD1 }; Variables: AuthVars };
export const rowRoutes = new Hono<Ctx>();

const KINDS = [
  ["goals", "goals"],
  ["objectives", "objectives"],
  ["weak-spots", "weakSpots"],
] as const;

for (const [path, key] of KINDS) {
  const open = (c: Context<Ctx>) => {
    const reads = readReport(requestIdOf(c));
    const repo = tablesRepo(c.env.DB, {
      clock: () => Date.now(),
      onBad: reads.onBad,
    });
    return { reads, rows: repo[key] };
  };
  rowRoutes.get(`/${path}`, async (c) => {
    const { reads, rows } = open(c);
    const list = reads.counted(key, await rows.list());
    return c.json({ rows: [...list], ...leftOutField(reads) });
  });
  rowRoutes.get(`/${path}/:id`, async (c) => {
    const row = await open(c).rows.get(c.req.param("id"));
    return row ? c.json(row) : c.json({ error: "not found" }, 404);
  });
}
