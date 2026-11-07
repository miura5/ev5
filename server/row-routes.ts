// /api/v1 row reads, one pair per kind (CONTRACT §data.tables, §data.gate): the row as the domain shape returns it, so
// an area can read a row without the wire document. Read through the tables gate; a row
// the gate cannot parse is left out and counted in `left_out` (read-report.ts). Auth is applied by index.ts.
//   GET /goals              every live goal, in date order     GET /goals/:id
//   GET /objectives         every live objective               GET /objectives/:id
//   GET /weak-spots         every live weak spot               GET /weak-spots/:id
//   GET /sets               every live set                     GET /sets/:id
//   GET /items              every live set item, by set, pos   GET /items/:id
//   GET /sessions           every live session                 GET /sessions/:id
//   GET /notes              every live note                    GET /notes/:id
//   GET /links              every live link                    GET /links/:id
// Collections keep their own route (collection-routes.ts), so they are not repeated here.
// The older /docs?collection=… reads stay until the areas have moved.
import { Hono } from "hono";
import type { Context } from "hono";
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import type { AuthVars } from "./auth.ts";
import { leftOutField, readReport, requestIdOf } from "./read-report.ts";

type Ctx = { Bindings: { DB: DocsD1 }; Variables: AuthVars };
export const rowRoutes = new Hono<Ctx>();

// path, repository key, table (the name `onBad` reports, so a bad row is counted once)
const KINDS = [
  ["goals", "goals", "goals"],
  ["objectives", "objectives", "objectives"],
  ["weak-spots", "weakSpots", "weak_spots"],
  ["sets", "sets", "sets"],
  ["items", "setItems", "set_items"],
  ["sessions", "sessions", "sessions"],
  ["notes", "notes", "notes"],
  ["links", "links", "links"],
] as const;

for (const [path, key, table] of KINDS) {
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
    const list = reads.counted(table, await rows.list());
    return c.json({ rows: [...list], ...leftOutField(reads) });
  });
  rowRoutes.get(`/${path}/:id`, async (c) => {
    const row = await open(c).rows.get(c.req.param("id"));
    return row ? c.json(row) : c.json({ error: "not found" }, 404);
  });
}
