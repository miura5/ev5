// data: the D1 repositories. More names are exported when a consumer needs them.
export { docsRepo } from "./docs/repo.ts";
export type { D1Like as DocsD1 } from "./d1.ts";
/** @public The D1 binding shape under its neutral name. */
export type { D1Like } from "./d1.ts";
export { MAX_BODY, NO_DELETE } from "./protocol/protocol.ts";
/** @public The first consumer comes in a later task. */
export { tablesRepo } from "./tables/tables.ts";
/** @public */
export type { TablesRepo } from "./tables/tables.ts";
export { exportAll, checkPictures } from "./export/index.ts";
/** The refusal a gate throws for a row the rules turn down; the server answers it with a 4xx. */
export { WriteRefused } from "./tables/gate.ts";
/** @public The shape of a session read with its events. */
export type { StoredSession } from "./tables/sessions.ts";
