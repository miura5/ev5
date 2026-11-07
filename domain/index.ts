// The domain barrel: the parsers for the kinds v5 stores, so data/ and ops/ reach them through one door.
export { parseGoal } from "./goal/read.ts";
export { parseObjective } from "./objective/index.ts";
export {
  parseWeakSpot,
  deriveWeakSpot,
  isActive,
  reviewNeed,
} from "./weak-spot/index.ts";
export type { Attempt } from "./weak-spot/index.ts";
export { parseSet, setKey, itemKey } from "./set/index.ts";
export {
  scoreAnswer,
  itemType,
  numberAnswer,
  ITEM_TYPES,
  upgradeItem,
} from "./item/index.ts";
export { parseSession, type SessionEvent } from "./session/index.ts";
export {
  newSessionEventRow,
  newSessionRow,
  sessionDoc,
  sessionDocId,
  sessionEventId,
  sessionRowId,
  type NewSessionEventRow,
  type NewSessionRow,
} from "./session/rows.ts";
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
  MAX as NOTE_MAX,
  type Block,
  type Run,
  type Note,
} from "./note/index.ts";
export { noteRowId, noteDocId, noteDocOf, newNoteRow } from "./note/rows.ts";
export { accuracyLine, answersOf, dueCounts, gradedBySpot, type AnswerLike } from "./answers/index.ts";
export { goalDaysLeft } from "./goal/read.ts";
export type { Goal } from "./goal/read.ts";
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
export {
  parseJobPlanRow,
  parseStoredPlan,
  parseStoredPlanBody,
} from "./job-plan/index.ts";
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
export { parseDraftTableRow, draftKey } from "./draft/index.ts";
/** @public */
export {
  parseClaudeUsage,
  parseClaudeRead,
  parseClaudePlanAsk,
} from "./claude/index.ts";
/** @public */
export { parseSystemDoc } from "./system-doc/index.ts";
/** @public Docs-row shapes (`docs(c, id, data, at, v)`) for the kinds without a table of their own; the data gate imports them (not wired yet). */
export { parseObjectiveRow, type ObjectiveRow } from "./objective/row.ts";
/** @public Weak spot rows as the scheduler's model; the weak spot reads (plan home, Today, Library) import it when they move to the tables. */
export {
  eventFromRow,
  newWeakSpotRow,
  type NewWeakSpotRow,
  weakSpotDoc,
  weakSpotFromRows,
} from "./weak-spot/rows.ts";
/** @public */
export { parseSessionRow, type SessionRow } from "./session/row.ts";
/** @public */
export { parseNoteRow, type NoteRow } from "./note/row.ts";
/** @public The plan date rules: the last day, when a plan has ended, and what Matt is told. */
export { lastDay, planEnded, endedReason } from "./plan/index.ts";
/** @public Row shapes for the new per-kind tables; the tables gate and the migration import them. */
export { prefixed, WRITERS } from "./table-row/index.ts";
/** @public */
export {
  DATE_KINDS,
  kindOffers,
  parseGoalRow,
  toolsForKind,
  type DateTool,
  type GoalRow,
} from "./goal/index.ts";
/** @public */
export { parseLinkRow, LINK_PAIRS, type LinkRow } from "./link/index.ts";
/** @public */
export { parseAttemptRow, type AttemptRow } from "./attempt/index.ts";
/** @public */
export { parseTalkRow, type TalkRow } from "./talk/index.ts";
/** @public */
export { parseCollectionRow, type CollectionRow } from "./collection/table.ts";
/** @public */
export {
  parseObjectiveTableRow,
  type ObjectiveTableRow,
} from "./objective/table.ts";
/** @public */
export {
  parseWeakSpotTableRow,
  parseWeakSpotEventRow,
  type WeakSpotTableRow,
  type WeakSpotEventRow,
} from "./weak-spot/table.ts";
/** @public */
export {
  parseSetTableRow,
  parseSetItemRow,
  parseSetItemVersionRow,
  type SetTableRow,
  type SetItemRow,
  type SetItemVersionRow,
} from "./set/table.ts";
/** @public */
export {
  parseSessionTableRow,
  parseSessionEventRow,
  type SessionTableRow,
  type SessionEventRow,
} from "./session/table.ts";
/** @public */
export { parseNoteTableRow, type NoteTableRow } from "./note/table.ts";
/** @public Plan body (the job's output) and the new-table row shapes for plans, plan_items and repeats. */
export {
  planBodySchema,
  planItemInputSchema,
  planItemPatchSchema,
  type PlanBody,
  type PlanTask,
} from "./plan/body.ts";
/** @public */
export {
  parsePlanTableRow,
  parsePlanItemTableRow,
  parseRepeatRow,
  planTableWrite,
  planTableId,
} from "./plan/table.ts";
/** @public */
export { parsePinTableRow } from "./pin/table.ts";
/** @public */
export { parseSettingRow } from "./settings/index.ts";
/** @public */
export { parseFileRow } from "./file/index.ts";
