// The document size budget (CONTRACT §data.size): each stored document is measured against its platform
// ceiling, D1's 2 MB row limit. At 75% a write goes through with a warning; at 90% it is refused with a plain reason.
import { canonicalText, type Json } from "./protocol/canonical.ts";

export const DOC_CEILING = 2_000_000;
export const FAIL_AT = 0.9;

export const docBytes = (data: Json): number =>
  new TextEncoder().encode(canonicalText(data)).length;

const pct = (bytes: number, ceiling: number) =>
  Math.round((bytes / ceiling) * 1000) / 10;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

/** The reason a document of this size is refused (90% or more of the ceiling), else null. */
export function sizeRefusal(data: Json, ceiling = DOC_CEILING): string | null {
  const bytes = docBytes(data);
  return bytes >= ceiling * FAIL_AT
    ? `this document would be ${kb(bytes)}, ${pct(bytes, ceiling)}% of the ${kb(ceiling)} a stored document can hold (the limit is ${FAIL_AT * 100}%)`
    : null;
}
