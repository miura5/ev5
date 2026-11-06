// Note pictures in the export and the restore drill (§data.export, §data.note-images, §hard.data-never-lost). The
// export carries every `files` row (id, type, size, SHA-256, r2_key) in `rows.files`; the bytes stay in R2 and are
// listed there by hash. This checks a bucket against those rows: a missing object, bytes that differ from the
// recorded size or SHA-256, and orphans (an object under note-images/ with no row). Read-only: nothing is dropped.
import type { Row } from "./export.ts";

/** The slice of an R2 bucket this reads. */
export interface PictureBucket {
  list(o: { prefix: string; cursor?: string }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

export interface PictureReport {
  /** Row-side findings: no object, wrong size or wrong hash. These are failures. */
  problems: string[];
  /** Bucket-side findings: an object with no live files row. Reported, never dropped. */
  orphans: string[];
  /** Pictures read and matched. */
  checked: number;
}

const PREFIX = "note-images/";
const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function checkPictures(
  files: Row[],
  bucket: PictureBucket,
): Promise<PictureReport> {
  const report: PictureReport = { problems: [], orphans: [], checked: 0 };
  const keys = new Set<string>();
  for (let cursor: string | undefined; ; ) {
    const page = await bucket.list({ prefix: PREFIX, cursor });
    for (const o of page.objects) keys.add(o.key);
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  const rowKeys = new Set<string>();
  for (const f of files) {
    if (f.kind !== "note_image" || f.deleted_at != null) continue;
    const key = f.r2_key as string;
    rowKeys.add(key);
    const obj = keys.has(key) ? await bucket.get(key) : null;
    if (!obj) {
      report.problems.push(`picture ${f.id}: no object at ${key}`);
      continue;
    }
    const bytes = await obj.arrayBuffer();
    if (bytes.byteLength !== f.size)
      report.problems.push(
        `picture ${f.id}: ${bytes.byteLength} bytes, ${f.size} recorded`,
      );
    else if (hex(await crypto.subtle.digest("SHA-256", bytes)) !== f.sha256)
      report.problems.push(`picture ${f.id}: the SHA-256 differs`);
    else report.checked++;
  }
  for (const k of [...keys].sort())
    if (!rowKeys.has(k)) report.orphans.push(`picture ${k}: no files row`);
  return report;
}
