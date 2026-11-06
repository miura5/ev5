import { OPEN_LIMITS, wordCount, type Item, type OpenLimits } from './types.ts';

/** An open item's check function: one short question, 2 or 3 key points with keyword groups, a model answer, a source. */
export function openItemErrors(q: Item, o: OpenLimits = OPEN_LIMITS): string[] {
  const errors: string[] = [];
  if (wordCount(q.stem) > o.stemMaxWords) errors.push(`an open stem has at most ${o.stemMaxWords} words`);
  if ((String(q.stem || '').match(/\?/g) || []).length > 1) errors.push('an open stem asks one question');
  const kp: unknown = q.keyPoints;
  if (!Array.isArray(kp) || kp.length < o.keyPointsMin || kp.length > o.keyPointsMax)
    errors.push(`an open item needs ${o.keyPointsMin} or ${o.keyPointsMax} key points`);
  else
    kp.forEach((k, i) => {
      if (!k || typeof k.text !== 'string' || !k.text.trim()) errors.push(`key point ${i + 1} has no text`);
      else if (wordCount(k.text) > o.keyPointMaxWords)
        errors.push(`key point ${i + 1} has more than ${o.keyPointMaxWords} words`);
      const g = k && k.keywords;
      if (
        !Array.isArray(g) ||
        !g.length ||
        g.some((x) => !Array.isArray(x) || !x.length || x.some((w) => typeof w !== 'string' || !w.trim()))
      )
        errors.push(`key point ${i + 1} needs keyword groups`);
    });
  if (typeof q.modelAnswer !== 'string' || !q.modelAnswer.trim()) errors.push('an open item needs a model answer');
  if (typeof q.sourceRef !== 'string' || !q.sourceRef.trim()) errors.push('an open item needs its sourceRef');
  const loose = q as Record<string, unknown>;
  if (q.options || q.correct || q.grid || loose.answer != null) errors.push('an open item has no options or answer');
  return errors;
}
