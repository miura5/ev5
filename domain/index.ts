// The domain barrel: the parsers for the kinds v5 stores, so data/ and ops/ reach them through one door.
export { parseExam } from "./exam/index.ts";
export { parseObjective } from "./objective/index.ts";
export {
  parseWeakSpot,
  deriveWeakSpot,
  isActive,
  reviewNeed,
} from "./weak-spot/index.ts";
export type { Attempt } from "./weak-spot/index.ts";
export { parseSet, scoreAnswer, itemType } from "./set/index.ts";
export { parseSession } from "./session/index.ts";
export {
  parseNote,
  writeProblem as noteWriteProblem,
  resolveStale,
  newNoteId,
  noteDoc,
  noteBlocks,
  fits,
  splitWide,
  IMG_KEY,
  type Block,
  type Run,
  type Note,
} from "./note/index.ts";
export { accuracyLine, dueCounts } from "./answers/index.ts";
export { examDaysLeft } from "./exam/index.ts";
export type { Exam } from "./exam/index.ts";
export {
  addDays,
  centralDate,
  centralParts,
  clockTime,
  daysBetween,
  inDays,
  isDue,
  longDay,
  plainDay,
  shortDay,
  weekday,
  weekdayDay,
  weekdayShort,
} from "./time/index.ts";
/** @public Read by areas/sessions (exported for it; the sessions area wires it). */
export { sessionState } from "./session/index.ts";
export {
  parseCollection,
  parseMembership,
  moveWrite,
} from "./collection/index.ts";
export {
  parseItemProps,
  materialize,
  missingOccurrences,
} from "./item-props/index.ts";
export { parsePin } from "./pin/index.ts";
export {
  parseOwnSet,
  parseOwnSetItem,
  parseOwnAttempt,
} from "./own-set/index.ts";
export {
  chunkMaterials,
  buildIndex,
  search,
  likePatterns,
} from "./search/index.ts";
/** @public Row shapes for the side tables; the data gate and the job runtime import them (wired by follow-up tasks). */
export { parseDeletion } from "./deletion/index.ts";
/** @public */
export { parseJobPlanRow } from "./job-plan/index.ts";
/** @public */
export {
  parseJobRecord,
  JOB_STATES,
  type JobRecordRow,
} from "./job-record/index.ts";
/** @public */
export {
  parseCeilingUse,
  parseCeilingHold,
  parseCeilingUsage,
} from "./ceiling/index.ts";
/** @public */
export { parseDraft } from "./draft/index.ts";
/** @public */
export {
  parseClaudeUsage,
  parseClaudeRead,
  parseClaudeSetting,
  parseClaudePlanAsk,
} from "./claude/index.ts";
/** @public */
export { parseSystemDoc } from "./system-doc/index.ts";
/** @public Docs-row shapes (`docs(c, id, data, at, v)`) for the kinds without a table of their own; the data gate imports them (not wired yet). */
export { docRowSchema } from "./doc-row/index.ts";
/** @public */
export { parseExamRow, type ExamRow } from "./exam/row.ts";
/** @public */
export { parseObjectiveRow, type ObjectiveRow } from "./objective/row.ts";
/** @public */
export { parseWeakSpotRow, type WeakSpotRow } from "./weak-spot/row.ts";
/** @public */
export { parseSetRow, type SetRow } from "./set/row.ts";
/** @public */
export { parseSessionRow, type SessionRow } from "./session/row.ts";
/** @public */
export { parseNoteRow, type NoteRow } from "./note/row.ts";
/** @public Study plan rows and their approve and put-away paths; the study plan job and the data gate import them. */
export {
  parsePlanRow,
  parsePlanItemRow,
  approvePlan,
  putAwayPlan,
  settle,
  checkUnique,
  planId,
  type PlanRow,
  type PlanItemRow,
  type PlanWrite,
} from "./plan/index.ts";
