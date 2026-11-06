// domain/table-row: the parts every row of a v5 table shares (docs/proposals/table-design.md section 1).
// A table's row shape is one strict Zod object whose keys are its columns; JSON columns hold parsed values here.
import { z } from "zod";

/** A time-sortable id with the kind's prefix, e.g. `goal_01J...`; the migration's CHECK repeats the prefix (§data.tables). */
export const prefixed = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 1)
    .startsWith(prefix, `id must start with ${prefix}`);

/** Worker-clock milliseconds. */
export const ms = z.number().int().min(0);
/** `at` and `v` on every table (§data.protocol). */
export const stamp = { at: ms, v: z.number().int().min(1) };
/** `deleted_at`: set on the tables the user can delete, and only there (§delete.soft). */
export const deletable = { deleted_at: ms.nullable() };
/** Who wrote a row. The user's name is never data (per the table-design decision). */
export const WRITERS = ["user", "ev"] as const;
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD");
export const text = z.string().min(1);
/** A nested body kept as JSON text in the database. */
export const json = z.json();
