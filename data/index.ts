// data: the D1 repositories. More names are exported when a consumer needs them.
export { docsRepo } from "./docs/repo.ts";
export type { D1Like as DocsD1 } from "./docs/d1.ts";
export { MAX_BODY, NO_DELETE } from "./protocol/protocol.ts";
/** @public The first consumer comes in a later task. */
export { tablesRepo } from "./tables/tables.ts";
/** @public */
export type { TablesRepo } from "./tables/tables.ts";
export { exportAll } from "./export/index.ts";
