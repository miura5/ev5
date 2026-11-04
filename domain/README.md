# domain/

Pure rules, no IO: one folder per entity, plus `search/` and `time/`. Imports follow §drift.imports; time zone is `Intl`.

<!-- generated:start -->
Interface: parseExam, parseObjective, parseWeakSpot, deriveWeakSpot, isActive, reviewNeed, Attempt, parseSet, parseSession, parseNote, resolveStale, newNoteId, noteDoc, noteBlocks, fits, splitWide, type Block, type Run, type Note, examDaysLeft, Exam, addDays, centralDate, sessionState
Imports: nothing outside its folder; npm: zod, ts-fsrs (§drift.imports)
<!-- generated:end -->
