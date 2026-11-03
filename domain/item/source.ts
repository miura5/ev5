import { sameCourse } from '../objective/index.ts';
import { ITEM_CONFIG, type Item, type ItemConfig } from './types.ts';

// An item's source: dosage material (the only ground a numeric item stands on) and cross-course items. A question
// may rest on another course's passage when it is the same concept, names its source and still targets an objective of
// its own course; a miss files one weak spot, under that objective. No course is named here: an item's source is its
// sourceRef (materials/<id>), its own course is its objective's exam's course (else its set's exam's), and the two are
// compared as data.

/** Dosage material: a library file whose title or module matches the dosage pattern and not its skip pattern. */
export function isDosageMaterial(
  m: { title?: string; module?: string } | null | undefined,
  cfg: ItemConfig = ITEM_CONFIG,
): boolean {
  const t = `${m?.title || ''} ${m?.module || ''}`;
  return new RegExp(cfg.dosage.match || 'dosage', 'i').test(t) && !new RegExp(cfg.dosage.skip || '(?!)', 'i').test(t);
}

/** A topic that asks for dosage practice (a make-practice ask, a plan's drill title). */
export const isDosageTopic = (t: unknown): boolean =>
  /\b(dosage|dose calc\w*|drug calc\w*|med(ication)?[ -]?math|drip rates?|iv rates?|infusion rates?)\b/i.test(
    String(t ?? ''),
  );

type Exam = { id: string; course?: string };
type CrossCtx = {
  materials?: { id: string; course?: string; title?: string }[];
  exams?: Exam[];
  objectives?: { id: string; exam: string }[];
  set?: { exam?: string | null; focus?: unknown } | null;
};
export type CrossCourse = {
  course: string | null;
  item: Item;
  source: { course: string; title: string; label: string } | null;
  errors: string[];
};

/** Where an item stands across courses: the course it counts toward (or null), the item to keep (its stem naming its
 *  source when it rests on another course's material and does not say so already; open items are left as written), the
 *  source when it rests on another course's material, and why it may not be kept. */
export function crossCourse(q: Item, ctx: CrossCtx = {}, cfg: ItemConfig = ITEM_CONFIG): CrossCourse {
  const exams = ctx.exams || [];
  const obj = q && q.objective ? (ctx.objectives || []).find((o) => o && o.id === q.objective) : null;
  const examId = (obj && obj.exam) || (q && q.objective ? String(q.objective).split('-')[0] : '') || '';
  const exam = exams.find((e) => e && e.id === examId) || exams.find((e) => e && ctx.set && e.id === ctx.set.exam);
  // with no exam, the course its set was written for (its focus), never a default course
  const focus = ctx.set && typeof ctx.set.focus === 'string' ? ctx.set.focus : '';
  const named = cfg.courses.find((c) => sameCourse(c, focus));
  const course = (exam && exam.course) || (focus && named) || null;
  const ref = /^materials\/(.+)$/.exec(String((q && q.sourceRef) || ''));
  const m = ref ? (ctx.materials || []).find((x) => x && x.id === ref[1]) : null;
  if (!m || !m.course || !course || sameCourse(m.course, course)) return { course, source: null, errors: [], item: q };
  const title = String(m.title || m.id).replace(/\.(pdf|docx|pptx|txt|md)$/i, '');
  const source = { course: String(m.course), title, label: 'from ' + m.course + ': ' + title };
  const own = !!(q.objective && (obj || exams.some((e) => e && e.id === examId)));
  // the question names its source: a stem that does not already say where it comes from gets the label added
  const says = new RegExp('from\\s+' + String(m.course).replace(/[^A-Za-z0-9]+/g, '\\s*'), 'i').test(q.stem || '');
  const item = says || q.type === 'open' ? q : { ...q, stem: String(q.stem || '').trim() + ' (' + source.label + ')' };
  return {
    course,
    source,
    item,
    errors: own ? [] : [`rests on ${m.course} material (${title}) but targets no objective of its own course`],
  };
}
