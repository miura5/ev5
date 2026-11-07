// The job-records list query (§data.gate): the options narrow the rows in SQL so a list never reads the whole table.
export type JobListOptions = {
  /** Keep records changed (their `updatedAt`) at or after this time (ms). */
  since?: number;
  /** Keep one job kind. */
  kind?: string;
  /** Keep records not yet done or failed. */
  open?: boolean;
};

export function jobListQuery(o: JobListOptions): {
  sql: string;
  binds: string[];
} {
  const where: string[] = [];
  const binds: string[] = [];
  if (o.since !== undefined) {
    where.push("json_extract(data, '$.updatedAt') >= ?");
    binds.push(new Date(o.since).toISOString());
  }
  if (o.kind !== undefined) {
    where.push("json_extract(data, '$.kind') = ?");
    binds.push(o.kind);
  }
  if (o.open)
    where.push("json_extract(data, '$.state') NOT IN ('done', 'failed')");
  return {
    sql: `SELECT id, data FROM job_records${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY at, id`,
    binds,
  };
}
