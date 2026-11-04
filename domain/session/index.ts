// Study sessions: the clock and counts rebuilt from the events map, starting, switching and Undo through
// marks, the filing mark, and read-along. Ported from ev4 core/sessions.mjs; prompts, the wrap-up parser and the
// findings filed at close are not here (they belong to the study-session job).
export { parseSession } from './parse.ts';
export { sessionState } from './state.ts';
export { startSession, switchSession, switchedAt, undoSwitch, filingOf, endingOf } from './lifecycle.ts';
export { noteMark, noteDelta, readAlongAsk } from './note.ts';
export type { SessionDoc, SessionEvent, SessionWrite } from './types.ts';
