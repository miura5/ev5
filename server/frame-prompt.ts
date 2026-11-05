// Course framing for the prompts (§data.course-facts: no course is named in code). The course table is data in the
// system document `spec`; a prompt's wording follows the course in context through domain/course (§ev.course-frame):
// a course flagged nursing keeps the nursing wording, another course gets its own exams, none known gets neutral words.
import { examFrame, parseCourseTable } from "../domain/index.ts";
import type { CourseTable } from "../domain/index.ts";
import type { D1Like } from "../jobs/index.ts";

/** The course table from the `spec` system document; empty (neutral wording) when it is missing or unreadable. */
export async function loadCourseTable(db: D1Like): Promise<CourseTable> {
  try {
    const row = await db
      .prepare("SELECT data FROM system_docs WHERE name = 'spec'")
      .first<{ data: string }>();
    if (!row) return [];
    return parseCourseTable((JSON.parse(row.data) as { courses?: unknown }).courses);
  } catch {
    return [];
  }
}

/** The text with its `{{student}}` slot and NCLEX wording framed for the course (null or unknown: neutral). */
export function framePrompt(table: CourseTable, text: string, course?: string | null): string {
  const f = examFrame(table, course);
  const named = course && table.some((c) => c.name === course) ? course : null;
  const student = f.nursing ? "one nursing student" : named ? `one student of ${named}` : "one student";
  const style = f.nursing ? "NCLEX-style" : named ? `${named} exam-style` : "exam-style";
  // frameText's non-nursing style words repeat "NCLEX", so the one phrase these prompts use is set here.
  return text.replaceAll("NCLEX-style", style).replaceAll("{{student}}", student);
}

/** The course of a prompt's subject, read from the table in D1. */
export function framed(db: D1Like): (text: string, course?: string | null) => Promise<string> {
  return async (text, course) => framePrompt(await loadCourseTable(db), text, course);
}

/** A set's course: its exam's. Null when the set has no exam or the exam has no course. */
export async function courseOfSet(db: D1Like, setId: string): Promise<string | null> {
  const field = async (c: string, id: string, key: string) => {
    const row = await db.prepare("SELECT data FROM docs WHERE c = ? AND id = ?").bind(c, id).first<{ data: string }>();
    try {
      const v = (JSON.parse(row?.data ?? "null") as Record<string, unknown> | null)?.[key];
      return typeof v === "string" && v ? v : null;
    } catch {
      return null;
    }
  };
  const exam = await field("sets", setId, "exam");
  return exam ? field("exams", exam, "course") : null;
}
