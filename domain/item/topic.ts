import type { Item } from './types.ts';

// A quiz on a chapter or topic: "Make a mock exam for chapter 9" quizzes on chapter 9 only. A question is on a chapter
// by its objective's chapters, its source's title, its own words or its set's title; on other words when at least half
// of the topic's words show in its topic, stem or set title.
const CHAPTER = /\bch(?:apters?|aps?|s)?\.?\s*#?\s*(\d{1,3})\b/i;

/** The chapter a text names ("chapter 9", "Ch. 9", "ch9"), as a number; null when none. */
export function chapterOf(text: unknown): number | null {
  const m = CHAPTER.exec(String(text ?? ''));
  return m ? Number(m[1]) : null;
}

/** An objective's chapters (an array of numbers or strings, or one string: "9", "Ch 9", "9-11") as a Set of numbers. */
export function chapterNums(chapters: unknown): Set<number> {
  const out = new Set<number>();
  for (const c of Array.isArray(chapters) ? chapters : [chapters]) {
    if (typeof c === 'number' && Number.isInteger(c)) out.add(c);
    else
      for (const m of String(c ?? '').matchAll(/(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g)) {
        const a = Number(m[1]);
        const b = m[2] ? Number(m[2]) : a;
        for (let n = a; n <= b && n - a < 30; n++) out.add(n);
      }
  }
  return out;
}

const TOPIC_STOP = new Set(
  'quiz quizzes mock exam exams test tests practice question questions chapter chapters unit units module modules lecture lectures about from with give make some more please full review this that over cover covering whole'.split(
    ' ',
  ),
);
/** A text's topic words: four letters or more, not quiz words, cut to their first four. */
function topicWords(text: unknown): string[] {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !TOPIC_STOP.has(w))
    .map((w) => w.slice(0, 4));
}

type Ref = { id: string; title?: string; chapters?: unknown };

/** (q, set) => whether a question is on the topic he named; null when the topic names no chapter and no words. */
export function topicMatcher(
  topic: unknown,
  ctx: { objectives?: Ref[]; materials?: Ref[] } = {},
): ((q: Item | null, set?: { title?: string } | null) => boolean) | null {
  const { objectives = [], materials = [] } = ctx;
  const ch = chapterOf(topic);
  const words = [...new Set(topicWords(topic))];
  if (ch == null && !words.length) return null;
  return (q, set) => {
    if (!q) return false;
    if (ch != null) {
      const o = q.objective ? objectives.find((x) => x && x.id === q.objective) : null;
      if (o && chapterNums(o.chapters).has(ch)) return true;
      const ref = /^materials\/(.+)$/.exec(String(q.sourceRef ?? ''));
      const m = ref ? materials.find((x) => x && x.id === ref[1]) : null;
      return [q.topic, q.stem, m && m.title, set && set.title].some((s) => chapterOf(s) === ch);
    }
    const hay = new Set(topicWords(`${q.topic || ''} ${q.stem || ''} ${set?.title || ''}`));
    return words.filter((w) => hay.has(w)).length >= Math.ceil(words.length / 2);
  };
}
