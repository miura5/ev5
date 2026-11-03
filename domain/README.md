# domain/

Pure rules, no IO: one folder per entity, plus `search/` and `time/`. Imports only `zod` and `@date-fns/tz`.

<!-- generated:start -->
Interface: parseExam, parseObjective, parseWeakSpot, deriveWeakSpot, isActive, reviewNeed, Attempt, parseSet, parseSession, parseNote, examDaysLeft, Exam, addDays, centralDate, parseCourseTable, CourseRule, CourseTable, parseCollection, parseMembership, Collection, Membership, parsePin, Pin, parseDraft, Draft, DraftWrite, DraftBatch, SetItem, StudySet
Imports: nothing outside its folder; npm: zod, @date-fns/tz, ts-fsrs (§drift.imports)
<!-- generated:end -->
