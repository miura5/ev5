// What a request's table reads left out (§data.gate): rows that did not parse are logged under the request id, and the
// count goes back to the caller beside the rows it did get. The log line carries the table, row id and reason, never row text.
import type { Context } from "hono";

export interface Reads {
  /** Passed to the table repositories as `onBad`. */
  onBad: (b: { table: string; id: string; reason: string }) => void;
  /** Notes the `left_out` count a table list carries; returns the list unchanged. */
  counted: <T extends { left_out?: number }>(table: string, rows: T) => T;
  /** Stored rows this request's reads left out, each counted once however many times it was read. */
  leftOut: () => number;
}

export function readReport(requestId: string): Reads {
  const listed = new Map<string, number>();
  const bad = new Map<string, Set<string>>();
  return {
    onBad(b) {
      const ids = bad.get(b.table) ?? new Set<string>();
      bad.set(b.table, ids);
      if (ids.has(b.id)) return;
      ids.add(b.id);
      console.warn(
        JSON.stringify({
          event: "row_left_out",
          requestId,
          table: b.table,
          id: b.id,
          reason: b.reason,
        }),
      );
    },
    counted(table, rows) {
      listed.set(table, Math.max(listed.get(table) ?? 0, rows.left_out ?? 0));
      return rows;
    },
    leftOut() {
      let n = 0;
      for (const t of new Set([...listed.keys(), ...bad.keys()]))
        n += Math.max(listed.get(t) ?? 0, bad.get(t)?.size ?? 0);
      return n;
    },
  };
}

/** The request's id (set by the Worker's middleware), or a fresh one when a route runs without it. */
export function requestIdOf(c: Context): string {
  return (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
}

/** `{left_out: n}` to spread into a list answer, only when a read left something out. */
export function leftOutField(r: Reads): { left_out?: number } {
  const n = r.leftOut();
  return n > 0 ? { left_out: n } : {};
}
