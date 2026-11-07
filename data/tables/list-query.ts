// The list query of a kind table (§data.gate): equality filters (`where`), lower bounds (`min`) and a page.
export type ListOptions = {
  deleted?: boolean;
  where?: Partial<Record<string, string | number>>;
  /** Rows whose column is at least this number, so a list can leave out old rows in the query. */
  min?: Partial<Record<string, number>>;
  page?: { limit: number; offset: number };
};

export function listQuery(
  table: string,
  cols: string[],
  order: string,
  liveClause: string,
  o: ListOptions,
): { sql: string; binds: (string | number)[] } {
  const w: [string, string, string | number | undefined][] = [
    ...Object.entries(o.where ?? {}).map(
      ([c, x]): [string, string, string | number | undefined] => [c, "=", x],
    ),
    ...Object.entries(o.min ?? {}).map(
      ([c, x]): [string, string, string | number | undefined] => [c, ">=", x],
    ),
  ];
  for (const [c] of w)
    if (!cols.includes(c)) throw new Error(`${table} has no column ${c}`);
  return {
    sql: `SELECT * FROM ${table} WHERE 1 = 1${liveClause}${w.map(([c, op]) => ` AND "${c}" ${op} ?`).join("")} ORDER BY ${order}${o.page ? " LIMIT ? OFFSET ?" : ""}`,
    binds: [
      ...w.map(([, , x]) => x as string | number),
      ...(o.page ? [o.page.limit, o.page.offset] : []),
    ],
  };
}
