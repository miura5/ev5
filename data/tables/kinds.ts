// The tables gate for the per-kind tables of migration 0006 (§data.gate, §data.tables): one generic reader and writer, and
// one entry per table naming its domain row shape. Every row read is parsed (a bad one is reported and left out), a deleted
// row is left out unless asked (§delete.soft), every write is parsed and size-checked by gateRow before SQL, and only a
// stale version answers 409 (§data.protocol). Append-only tables have `add` and no change or delete (§data.append-only).
import {
  parseAttemptRow,
  parseCollectionRow,
  parseFileRow,
  parseGoalRow,
  parseLinkRow,
  parseNoteTableRow,
  parseObjectiveTableRow,
  parsePinTableRow,
  parsePlanItemTableRow,
  parsePlanTableRow,
  parseRepeatRow,
  parseSessionEventRow,
  parseSessionTableRow,
  parseSetItemRow,
  parseSetItemVersionRow,
  parseSetTableRow,
  parseTalkRow,
  parseWeakSpotEventRow,
  parseWeakSpotTableRow,
} from "../../domain/index.ts";
import type { D1Like } from "../docs/d1.ts";
import { ALL_TABLES } from "../export/tables.ts";
import {
  core,
  insertConflict,
  listed,
  reportBad,
  text,
  type Listed,
  type Raw,
  type Saved,
  type TablesOptions,
} from "./core.ts";
import { gateRow } from "./gate.ts";

type Stamped = { id: string; at: number; v: number };
/** What a caller supplies: the row without the columns the gate sets (`at`, `v`, `deleted_at`). */
export type Fields<R> = Omit<R, "at" | "v" | "deleted_at">;

interface Kind<R> {
  table: string;
  parse: (raw: unknown) => R;
  /** Columns that hold JSON text, parsed on read and written as text. */
  json: string[];
  /** Append-only: rows are only added (no change, no delete). */
  appendOnly?: boolean;
  /** The order of a list. */
  order: string;
  /** Old column -> new column it copies, until the contract migration (written, never read). */
  mirror: Record<string, string>;
}

function kind<R>(
  table: string,
  parse: (raw: unknown) => R,
  json: string[] = [],
  order = "id",
  appendOnly = false,
  mirror: Record<string, string> = {},
): Kind<R> {
  return { table, parse, json, order, appendOnly, mirror };
}

function columns(table: string, mirrors: string[] = []): string[] {
  const t = ALL_TABLES.find((x) => x.name === table);
  if (!t) throw new Error(`no row table ${table}`);
  return t.columns.filter(
    (c) => !["id", "at", "v", "deleted_at", ...mirrors].includes(c),
  );
}

function table<R extends Stamped>(db: D1Like, opts: TablesOptions, k: Kind<R>) {
  const { all, first, putVersioned } = core(db, opts);
  const mirrored = Object.keys(k.mirror);
  const cols = columns(k.table, mirrored);
  const q = (c: string) => `"${c}"`; // by and until are keywords
  const deletable = ALL_TABLES.find(
    (x) => x.name === k.table,
  )!.columns.includes("deleted_at");
  const toRow = (r: Raw): R => {
    const o: Record<string, unknown> = { ...r };
    for (const c of mirrored) delete o[c];
    for (const c of k.json)
      o[c] = r[c] === null ? null : JSON.parse(String(r[c]));
    return k.parse(o);
  };
  /** The row as it will be stored: JSON columns as text, the gate's `at` and `v` on it. */
  const stored = (f: Record<string, unknown>) => {
    const o: Record<string, unknown> = { ...f };
    for (const c of k.json) o[c] = text(f[c]);
    return o;
  };
  const build = (
    f: Record<string, unknown>,
    v: number,
    at: number,
    deleted_at: number | null,
  ): R =>
    toRow({
      ...stored(f),
      at,
      v,
      ...(deletable ? { deleted_at } : {}),
    } as Raw);
  const parseOne = (r: Raw | null): R | null => {
    if (!r) return null;
    try {
      return toRow(r);
    } catch (e) {
      reportBad(opts, k.table, String(r.id ?? "?"), e);
      return null;
    }
  };
  const live = (deleted?: boolean) =>
    deletable && !deleted ? " AND deleted_at IS NULL" : "";

  const read = {
    /** One row, or null when missing, deleted (unless asked) or unreadable (reported). */
    get: async (id: string, o: { deleted?: boolean } = {}): Promise<R | null> =>
      parseOne(
        await first(
          `SELECT * FROM ${k.table} WHERE id = ?${live(o.deleted)}`,
          id,
        ),
      ),
    /** Every readable row; a bad one is reported through onBad and left out. */
    list: async (
      o: {
        deleted?: boolean;
        where?: Partial<Record<string, string | number>>;
      } = {},
    ): Promise<Listed<R>> => {
      const w = Object.entries(o.where ?? {});
      for (const [c] of w)
        if (!cols.includes(c)) throw new Error(`${k.table} has no column ${c}`);
      const rows = await all(
        `SELECT * FROM ${k.table} WHERE 1 = 1${live(o.deleted)}${w.map(([c]) => ` AND ${q(c)} = ?`).join("")} ORDER BY ${k.order}`,
        ...w.map(([, x]) => x as string | number),
      );
      const out = rows.flatMap((r) => parseOne(r) ?? []);
      return listed(out, rows.length - out.length);
    },
  };
  if (k.appendOnly)
    return {
      ...read,
      /** Appends a row (version 1); an id already stored is a conflict. */
      add: async (f: Fields<R>): Promise<Saved<R>> => {
        const row = gateRow(k.table, () =>
          build(f as Record<string, unknown>, 1, opts.clock(), null),
        );
        const s = stored(f as Record<string, unknown>);
        const names = ["id", ...cols, "at", "v"];
        try {
          await db
            .prepare(
              `INSERT INTO ${k.table} (${names.map(q).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
            )
            .bind(
              row.id,
              ...cols.map((c) => s[c] as string | number | null),
              row.at,
              1,
            )
            .run();
        } catch (e) {
          insertConflict(k.table, e);
          return { ok: false, conflict: true, current: 1 };
        }
        return { ok: true, row };
      },
    };
  return {
    ...read,
    /** Creates (ifVersion null) or changes at the version read; a deleted row is changed only by `restore`. */
    save: async (f: Fields<R>, ifVersion: number | null): Promise<Saved<R>> => {
      const id = (f as { id: string }).id;
      const cur = await first(
        `SELECT deleted_at FROM ${k.table} WHERE id = ?`,
        id,
      );
      const was = (cur?.deleted_at as number | null | undefined) ?? null;
      const rec = f as Record<string, unknown>;
      const s = stored(rec);
      return putVersioned(
        k.table,
        ["id"],
        [id],
        [...cols, ...mirrored].map(q),
        [
          ...cols.map((c) => s[c] as string | number | null),
          ...mirrored.map((c) => s[k.mirror[c]!] as string | number | null),
        ],
        ifVersion,
        (v, at) => build(rec, v, at, was),
      );
    },
    /** Soft delete (§delete.soft): sets `deleted_at` and bumps the version; stale is a conflict. */
    remove: async (id: string, ifVersion: number): Promise<Saved<R>> =>
      mark(id, ifVersion, true),
    /** Clears `deleted_at` on a deleted row. */
    restore: async (id: string, ifVersion: number): Promise<Saved<R>> =>
      mark(id, ifVersion, false),
  };

  async function mark(
    id: string,
    ifVersion: number,
    gone: boolean,
  ): Promise<Saved<R>> {
    const cur = await first(`SELECT * FROM ${k.table} WHERE id = ?`, id);
    const current = cur ? (cur.v as number) : null;
    if (!cur || current !== ifVersion)
      return { ok: false, conflict: true, current };
    const at = opts.clock();
    const row = gateRow(k.table, () =>
      toRow({ ...cur, at, v: ifVersion + 1, deleted_at: gone ? at : null }),
    );
    const r = await db
      .prepare(
        `UPDATE ${k.table} SET deleted_at = ?, at = ?, v = ? WHERE id = ? AND v = ?`,
      )
      .bind(gone ? at : null, at, ifVersion + 1, id, ifVersion)
      .run();
    if (r.meta.changes === 0) return { ok: false, conflict: true, current };
    return { ok: true, row };
  }
}

export function kindsRepo(db: D1Like, opts: TablesOptions) {
  type Repo<R extends Stamped> = ReturnType<typeof table<R>>;
  const t = <R extends Stamped>(k: Kind<R>) =>
    table(db, opts, k) as Extract<Repo<R>, { save: unknown }>;
  const a = <R extends Stamped>(k: Kind<R>) =>
    table(db, opts, k) as Extract<Repo<R>, { add: unknown }>;
  return {
    // Named apart from the older `collections` and `pins` repositories until the server step.
    collectionRows: t(kind("collections", parseCollectionRow)),
    pinRows: t(
      kind("pins", parsePinTableRow, [], "pos, id", false, {
        target_c: "target_kind",
      }),
    ),
    goals: t(kind("goals", parseGoalRow)),
    objectives: t(
      kind(
        "objectives",
        parseObjectiveTableRow,
        ["chapters", "source_ref"],
        "collection_id, num, id",
      ),
    ),
    links: t(kind("links", parseLinkRow)),
    notes: t(kind("notes", parseNoteTableRow, ["body"])),
    sets: t(kind("sets", parseSetTableRow, ["focus"])),
    setItems: t(
      kind(
        "set_items",
        parseSetItemRow,
        ["body", "source_ref"],
        "set_id, pos, id",
      ),
    ),
    setItemVersions: a(
      kind("set_item_versions", parseSetItemVersionRow, ["body"], "item_id, item_v", true),
    ),
    weakSpots: t(kind("weak_spots", parseWeakSpotTableRow)),
    weakSpotEvents: a(
      kind("weak_spot_events", parseWeakSpotEventRow, [], "weak_spot_id, at, id", true),
    ),
    attempts: a(kind("attempts", parseAttemptRow, ["answer"], "at, id", true)),
    sessions: t(kind("sessions", parseSessionTableRow, ["driver"])),
    sessionEvents: a(
      kind(
        "session_events",
        parseSessionEventRow,
        ["body"],
        "session_id, at, id",
        true,
      ),
    ),
    plans: t(kind("plans", parsePlanTableRow, [], "from_day, id")),
    planItems: t(kind("plan_items", parsePlanItemTableRow, [], "day, pos, id")),
    repeats: t(kind("repeats", parseRepeatRow, ["rule"], "from_day, id")),
    files: t(kind("files", parseFileRow)),
    talk: a(kind("talk", parseTalkRow, ["cites"], "chat_id, at, id", true)),
  };
}
