// Row id makers for the per-kind tables (§data.tables): a kind prefix and the caller's random part, no dashes.
// `pin_` ids are made by the pins repository, which fills them beside the write.

/** A new collection's id: `col_` and 32 hex letters from the handler's random id. */
export const colKey = (random: string): string =>
  `col_${random.replace(/[^A-Za-z0-9]/g, "")}`;
