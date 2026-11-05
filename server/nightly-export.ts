// The nightly export (CONTRACT §data.export): the whole-database export goes to R2 under exports/ in the existing
// bucket, one object per Central date, never overwritten. Counts only leave this file: no row text is logged or returned.
import { centralDate } from "../domain/index.ts";

/** The slice of an R2 bucket this needs. `onlyIf` makes the put fail (null) when the key already exists. */
export interface ExportBucket {
  head(key: string): Promise<unknown | null>;
  put(
    key: string,
    value: string,
    o?: {
      httpMetadata?: { contentType?: string };
      onlyIf?: { etagDoesNotMatch?: string };
    },
  ): Promise<unknown | null>;
}

/** The part of data's export this reads: the manifests, which carry the counts. */
export interface ExportResult {
  collections: Record<string, { count: number }>;
  tables: Record<string, { count: number }>;
}

export const EXPORT_PREFIX = "exports/";

/** The object key for a Central date. */
export const exportKey = (date: string): string =>
  `${EXPORT_PREFIX}ev-export-${date}.json`;

export interface ExportCounts {
  key: string;
  tables: number;
  rows: number;
}

/** True when the Central date's export already exists. */
export async function exportExists(
  bucket: ExportBucket,
  now: number,
): Promise<boolean> {
  return (await bucket.head(exportKey(centralDate(now)))) !== null;
}

/** Writes the export for now's Central date. Throws when that object exists (never overwritten); returns counts. */
export async function writeNightlyExport(
  bucket: ExportBucket,
  exportAll: (now: number) => Promise<ExportResult>,
  now: number,
): Promise<ExportCounts> {
  const key = exportKey(centralDate(now));
  if (await exportExists(bucket, now))
    throw new Error(`export ${key} already exists; not overwritten`);
  const data = await exportAll(now);
  const put = await bucket.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" },
    onlyIf: { etagDoesNotMatch: "*" },
  });
  if (put === null)
    throw new Error(`export ${key} already exists; not overwritten`);
  const counts = Object.values(data.tables).map((t) => t.count);
  return {
    key,
    tables: counts.length,
    rows: counts.reduce((a, b) => a + b, 0),
  };
}
