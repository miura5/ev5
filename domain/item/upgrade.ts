// Rows stored before B-1036 name two item types and one field the old way: 'sata' is now 'multi_select', 'matrix' is
// now 'grid' and its `matrix` field is `grid`. Stored rows are mapped on read; nothing rewrites them.
const LEGACY_TYPES: Record<string, string> = { sata: 'multi_select', matrix: 'grid' };

/** An item type as stored, in today's words. */
export const upgradeType = (t: unknown): unknown => (typeof t === 'string' ? (LEGACY_TYPES[t] ?? t) : t);

/** An item (or its body) as stored, in today's words: the type renamed and a `matrix` field moved to `grid`. */
export function upgradeItem<T>(raw: T): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const { matrix, ...rest } = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...rest };
  if ('type' in out) out.type = upgradeType(out.type);
  if (matrix !== undefined) out.grid = out.grid ?? matrix;
  return out as T;
}
