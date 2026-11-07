// Restore an export into an empty scratch D1 (migrations already applied), then prove it: the scratch's own manifest
// must equal the export's, and the PLAN §5.10 checks run. Orphans are reported, never dropped. Writes only to `scratch`.
import type { D1Like } from "../d1.ts";
import { ALL_TABLES } from "./tables.ts";
import { checkPictures, type PictureBucket } from "./pictures.ts";
import {
  EXPORT_KIND,
  exportAll,
  manifestDiffs,
  manifestOf,
  type Export,
  type Row,
} from "./export.ts";

const CHUNK = 50;

export interface RestoreReport {
  ok: boolean;
  /** Empty when every table and collection matches the export. */
  diffs: string[];
  /** §5.10 findings: reported, nothing dropped. */
  orphans: string[];
  /** Hard breaks: a grandparent collection, a missing parent. */
  problems: string[];
}

/** The export file must be v5's own and agree with its own manifest before anything is written. */
export async function checkExport(x: Export): Promise<string[]> {
  if (x.kind !== EXPORT_KIND || x.schema !== 1)
    return [`not an ${EXPORT_KIND} file: only v5's own export is restored`];
  const own = await manifestOf(x.rows);
  return manifestDiffs(own.tables, x.tables);
}

/** §5.10's last column, over the rows of a restored (or exported) record. */
export function checkRows(
  rows: Record<string, Row[]>,
): Pick<RestoreReport, "orphans" | "problems"> {
  const orphans: string[] = [];
  const problems: string[] = [];
  const cols = new Map(
    (rows.collections ?? []).map((r) => [r.id as string, r]),
  );
  for (const r of cols.values()) {
    if (r.parent_id == null) continue;
    const p = cols.get(r.parent_id as string);
    if (!p)
      problems.push(`collection ${r.id}: parent ${r.parent_id} does not exist`);
    else if (p.parent_id != null)
      problems.push(`collection ${r.id}: has a grandparent`);
  }
  // A membership's item_c names the collection an item was filed under; its row lives in that kind's own table.
  const kindTable: Record<string, string> = {
    goals: "goals",
    notes: "notes",
    sessions: "sessions",
    sets: "sets",
  };
  const items = new Set(
    Object.entries(kindTable).flatMap(([c, table]) =>
      (rows[table] ?? []).map((r) => `${c}\n${r.id}`),
    ),
  );
  for (const m of rows.memberships ?? []) {
    if (!items.has(`${m.item_c}\n${m.item_id}`))
      orphans.push(`membership ${m.item_c}/${m.item_id}: item missing`);
    if (!cols.has(m.collection_id as string))
      orphans.push(
        `membership ${m.item_c}/${m.item_id}: collection ${m.collection_id} missing`,
      );
  }
  const sets = new Set((rows.sets ?? []).map((r) => r.id as string));
  for (const i of rows.set_items ?? [])
    if (!sets.has(i.set_id as string))
      orphans.push(`set_item ${i.set_id}/${i.id}: set missing`);
  return { orphans, problems };
}

export async function restoreInto(
  scratch: D1Like,
  x: Export,
  pictures?: PictureBucket,
): Promise<RestoreReport> {
  const bad = await checkExport(x);
  if (bad.length) return { ok: false, diffs: bad, orphans: [], problems: [] };
  for (const spec of ALL_TABLES) {
    const rows = x.rows[spec.name] ?? [];
    const sql = `INSERT INTO ${spec.name} (${spec.columns.join(", ")}) VALUES (${spec.columns.map(() => "?").join(", ")})`;
    for (let i = 0; i < rows.length; i += CHUNK)
      await scratch.batch(
        rows
          .slice(i, i + CHUNK)
          .map((r) =>
            scratch.prepare(sql).bind(...spec.columns.map((c) => r[c] ?? null)),
          ),
      );
  }
  const back = await exportAll(scratch);
  const diffs = manifestDiffs(back.tables, x.tables);
  const { orphans, problems } = checkRows(back.rows);
  // With the bucket in hand, the drill reads every picture back against its files row (§data.note-images).
  if (pictures) {
    const p = await checkPictures(back.rows.files ?? [], pictures);
    problems.push(...p.problems);
    orphans.push(...p.orphans);
  }
  return {
    ok: diffs.length === 0 && problems.length === 0,
    diffs,
    orphans,
    problems,
  };
}
