// data: the D1 repositories. More names are exported when a consumer needs them.
export { docsRepo } from "./docs/repo.ts";
export type { D1Like as DocsD1 } from "./docs/d1.ts";
export { MAX_BODY, NO_DELETE } from "./compat/protocol.ts";
export { workerNoteProblem } from "./docs/worker-check.ts";
