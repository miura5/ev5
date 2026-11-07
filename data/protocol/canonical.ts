// The canonical JSON form every row body is stored in (§data.protocol): exactly the text JSON.stringify gives.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** The canonical text of a parsed document. */
export const canonicalText = (v: Json): string => JSON.stringify(v);
