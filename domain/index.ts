// The domain barrel: the parsers for the ev4 collections v5 reads, so data/ and ops/ reach them through one door.
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
export { examDaysLeft } from "./exam/index.ts";
export type { Exam } from "./exam/index.ts";
export { addDays, centralDate, plainDay, inDays } from "./time/index.ts";
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
export { parseCourseTable, examFrame, chatCourse } from "./course/index.ts";
export type { CourseTable } from "./course/types.ts";
