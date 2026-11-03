// domain/course: course rules as data (ev4 spec.courses). Every function takes the table; no course is named here.
export {
  parseCourseTable,
  defaultCourse,
  activeCourses,
  normCourse,
  courseOf,
  nameCourse,
  guessCourse,
  examIs,
} from './table.ts';
export { spotCourse, namedCourse, nextExamCourse, noteCourse, noteParts, taskCourse, taskStart } from './scope.ts';
export { examFrame, frameText, chatCourse, teachLine } from './frame.ts';
export type { CourseRule, CourseTable } from './types.ts';
