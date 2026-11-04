# domain/

Pure rules, no IO: one folder per entity, plus `search/` and `time/`. Imports only `zod` and `@date-fns/tz`.

<!-- generated:start -->
Interface: parseExam, parseObjective, parseWeakSpot, deriveWeakSpot, isActive, reviewNeed, Attempt, parseSet, parseSession, parseNote, resolveStale, newNoteId, noteDoc, type Block, type Note, examDaysLeft, Exam, addDays, centralDate, sessionState
Imports: nothing outside its folder; npm: zod, @date-fns/tz, ts-fsrs (§drift.imports)
<!-- generated:end -->
