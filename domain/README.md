# domain/

Pure rules, no IO: one folder per entity, plus `search/` and `time/`. Imports follow §drift.imports; time zone is `Intl`.

<!-- generated:start -->
Interface: parseExam, parseObjective, parseWeakSpot, deriveWeakSpot, isActive, reviewNeed, Attempt, parseSet, scoreAnswer, itemType, parseSession, parseNote, noteWriteProblem, resolveStale, newNoteId, noteDoc, noteBlocks, fits, splitWide, IMG_KEY, type Block, type Run, type Note, accuracyLine, dueCounts, examDaysLeft, Exam, addDays, centralDate, centralParts, clockTime, daysBetween, inDays, isDue, longDay, plainDay, shortDay, weekday, weekdayDay, weekdayShort, sessionState, parseCollection, parseMembership, moveWrite, parseItemProps, materialize, missingOccurrences, parsePin, parseOwnSet, parseOwnSetItem, parseOwnAttempt, chunkMaterials, buildIndex, search, likePatterns, parseDeletion, parseJobPlanRow, parseJobRecord, JOB_STATES, type JobRecordRow, parseCeilingUse, parseCeilingHold, parseCeilingUsage, parseDraft, parseClaudeUsage, parseClaudeRead, parseClaudeSetting, parseClaudePlanAsk, parseSystemDoc, docRowSchema, parseExamRow, type ExamRow, parseObjectiveRow, type ObjectiveRow, parseWeakSpotRow, type WeakSpotRow, parseSetRow, type SetRow, parseSessionRow, type SessionRow, parseNoteRow, type NoteRow, parsePlanRow, parsePlanItemRow, approvePlan, putAwayPlan, settle, checkUnique, planId, type PlanRow, type PlanItemRow, type PlanWrite
Imports: nothing outside its folder; npm: zod, ts-fsrs (§drift.imports)
<!-- generated:end -->
