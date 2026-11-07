// /api/v1 row reads, one pair per kind (CONTRACT §data.tables, §data.gate): the row as the domain shape returns it, so
// an area can read a row without the wire document. Read through the tables gate; a row
// the gate cannot parse is left out and counted in `left_out` (read-report.ts). Auth is applied by index.ts.
//   GET /goals              every live goal, in date order     GET /goals/:id
//   GET /objectives         every live objective               GET /objectives/:id
//   GET /weak-spots         every live weak spot               GET /weak-spots/:id
//   GET /weak-spot-events   every event, by spot, time         GET /weak-spot-events/:id
//   GET /sets               every live set                     GET /sets/:id
//   GET /items              every live set item, by set, pos   GET /items/:id
//   GET /sessions           every live session                 GET /sessions/:id
//   GET /notes              every live note                    GET /notes/:id
//   GET /links              every live link                    GET /links/:id
//   GET /attempts           every answer, oldest first         GET /attempts/:id
//   GET /plans              every live plan, by first day      GET /plans/:id
//   GET /plan-items         every live plan item, by day, pos  GET /plan-items/:id
//   GET /item-versions      every filed item version, by item  GET /item-versions/:id
//   GET /session-events     every session event, by session    GET /session-events/:id
// Collections keep their own route (collection-routes.ts), so they are not repeated here.
import { Hono } from "hono";
import type { Context } from "hono";
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import type { AuthVars } from "./auth.ts";
import { leftOutField, readReport, requestIdOf } from "./read-report.ts";

type Ctx = { Bindings: { DB: DocsD1 }; Variables: AuthVars };
export const rowRoutes = new Hono<Ctx>();
type Rows = {
  list(o?: {
    page: { limit: number; offset: number };
  }): Promise<readonly unknown[] & { left_out?: number }>;
  get(id: string): Promise<unknown>;
};

/** The most rows one list read returns; `next` is the offset of the following page. */
const PAGE = 1000;

// path, repository key, table (the name `onBad` reports, so a bad row is counted once)
const KINDS = [
  ["goals", "goals", "goals"],
  ["objectives", "objectives", "objectives"],
  ["weak-spots", "weakSpots", "weak_spots"],
  ["weak-spot-events", "weakSpotEvents", "weak_spot_events"],
  ["sets", "sets", "sets"],
  ["items", "setItems", "set_items"],
  ["sessions", "sessions", "sessions"],
  ["notes", "notes", "notes"],
  ["links", "links", "links"],
  ["attempts", "attempts", "attempts"],
  ["plans", "plans", "plans"],
  ["plan-items", "planItems", "plan_items"],
  ["item-versions", "setItemVersions", "set_item_versions"],
  ["session-events", "sessionEvents", "session_events"],
] as const;

for (const [path, key, table] of KINDS) {
  const open = (c: Context<Ctx>) => {
    const reads = readReport(requestIdOf(c));
    const repo = tablesRepo(c.env.DB, {
      clock: () => Date.now(),
      onBad: reads.onBad,
    });
    // One shape for every kind: the union of ten repositories is too deep for the checker to call.
    return { reads, rows: repo[key] as unknown as Rows };
  };
  rowRoutes.get(`/${path}`, async (c) => {
    const { reads, rows } = open(c);
    const limit = Math.min(
      Math.max(Math.trunc(Number(c.req.query("limit"))) || PAGE, 1),
      PAGE,
    );
    const offset = Math.max(Math.trunc(Number(c.req.query("offset"))) || 0, 0);
    // A page that comes back full, rows left out included, may be followed by another: a row left out still takes
    // its place in the page, so `next` must not depend on the parsed rows alone. The last page may be exactly full,
    // and then the next read is empty and carries no `next`.
    const got = await rows.list({ page: { limit, offset } });
    const more = got.length + (got.left_out ?? 0) >= limit;
    const list = reads.counted(table, got);
    return c.json({
      rows: [...list],
      ...(more ? { next: offset + limit } : {}),
      ...leftOutField(reads),
    });
  });
  rowRoutes.get(`/${path}/:id`, async (c) => {
    const row = await open(c).rows.get(c.req.param("id"));
    return row ? c.json(row) : c.json({ error: "not found" }, 404);
  });
}
