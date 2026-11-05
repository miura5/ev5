// Every table the export covers, with its columns and the order rows are hashed in (PLAN §5.10: each new table is
// listed here before it goes live). Columns are the table's full row; the order is its primary key.
export interface TableSpec {
  name: string;
  columns: string[];
  orderBy: string[];
}

const t = (name: string, columns: string[], orderBy: string[]): TableSpec => ({
  name,
  columns,
  orderBy,
});

/** ev4's tables (data/migrations/0000_baseline.sql) and the deletions table. `docs` is also grouped per collection. */
export const EV4_TABLES: TableSpec[] = [
  t("docs", ["c", "id", "data", "at", "v"], ["c", "id"]),
  t("deletions", ["c", "id", "at"], ["c", "id"]),
  t("claude_usage", ["hour", "day", "tokens", "calls"], ["hour"]),
  t("claude_reads", ["note", "h", "at"], ["note"]),
  t("claude_settings", ["key", "value", "at"], ["key"]),
  t("claude_plan_asks", ["job", "n", "at"], ["job"]),
  t("system_docs", ["name", "data", "at"], ["name"]),
];

/** The tables PLAN §5.10 adds. A table whose migration has not landed yet exports as empty. */
export const NEW_TABLES: TableSpec[] = [
  t("collections", ["id", "title", "parent_id", "pos", "at", "v"], ["id"]),
  t(
    "memberships",
    ["item_c", "item_id", "collection_id", "at", "v"],
    ["item_c", "item_id"],
  ),
  t("pins", ["target_c", "target_id", "pos", "at"], ["target_c", "target_id"]),
  t("views", ["id", "title", "query", "at", "v"], ["id"]),
  t(
    "item_props",
    [
      "c",
      "id",
      "time",
      "repeat",
      "linked_c",
      "linked_id",
      "overrides",
      "at",
      "v",
    ],
    ["c", "id"],
  ),
  t(
    "own_sets",
    ["id", "title", "type", "source_c", "source_id", "at", "v"],
    ["id"],
  ),
  t(
    "own_set_items",
    ["set_id", "item_id", "pos", "body", "at", "v"],
    ["set_id", "item_id"],
  ),
  t(
    "own_attempts",
    ["set_id", "item_id", "key", "at", "body"],
    ["set_id", "item_id", "key", "at"],
  ),
  t(
    "drafts",
    [
      "id",
      "job_id",
      "kind",
      "target_c",
      "target_id",
      "body",
      "state",
      "at",
      "v",
    ],
    ["id"],
  ),
];

/** Migration 0002: job records, cost ceilings and job plan content. */
export const JOB_TABLES: TableSpec[] = [
  t("job_records", ["id", "data", "at", "v"], ["id"]),
  t("ceiling_use", ["w", "k", "used"], ["w", "k"]),
  t("ceiling_holds", ["id", "amount", "limits", "open"], ["id"]),
  t("ceiling_usage", ["key", "hold_id"], ["key"]),
  t("job_plans", ["job_id", "kind", "body", "at"], ["job_id", "kind"]),
];

export const ALL_TABLES: TableSpec[] = [
  ...EV4_TABLES,
  ...NEW_TABLES,
  ...JOB_TABLES,
];

/** The per-target system documents an export leaves out (a Worker's token is never kept in its own backup). */
export const SYSTEM_PER_TARGET = [
  "worker",
  "manifest",
  "spec",
  "environments",
  "yourturn",
  "seed",
  "config",
  "code",
];
