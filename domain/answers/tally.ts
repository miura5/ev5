// domain/answers: what Matt's recorded answers (ev4 schema 2) say: due counts and the first-try accuracy line.
/** One stored document, as the wire carries it (restated: domain imports nothing outside its folder). */
interface AnswerDoc {
  id: string;
  data: unknown;
}

/** The first-try accuracy line, e.g. "72%, up from 66%". */
interface Accuracy {
  text: string;
}

const DAY = 86_400_000;
const WINDOW = 14 * DAY;

interface Try {
  at: number;
  /** undefined for a "just tell me" tap: it is neither right nor wrong. */
  correct?: boolean;
}

/** Every attempt in the `answers` documents (ev4 schema 2), by set then item; anything malformed is skipped. */
function attemptsByItem(
  docs: readonly AnswerDoc[],
): Map<string, Map<string, Try[]>> {
  const out = new Map<string, Map<string, Try[]>>();
  for (const d of docs) {
    const doc = d.data as { setId?: unknown; answers?: unknown } | null;
    if (!doc || typeof doc.setId !== "string") continue;
    if (!doc.answers || typeof doc.answers !== "object") continue;
    const items = out.get(doc.setId) ?? new Map<string, Try[]>();
    for (const [itemId, keyed] of Object.entries(doc.answers)) {
      if (!keyed || typeof keyed !== "object") continue;
      for (const a of Object.values(keyed as Record<string, unknown>)) {
        const r = a as { at?: unknown; correct?: unknown } | null;
        const at = typeof r?.at === "string" ? Date.parse(r.at) : NaN;
        if (Number.isNaN(at)) continue;
        const list = items.get(itemId) ?? [];
        list.push({
          at,
          ...(typeof r?.correct === "boolean" ? { correct: r.correct } : {}),
        });
        items.set(itemId, list);
      }
    }
    out.set(doc.setId, items);
  }
  return out;
}

/** How many of a set's items are due: the latest answer was wrong or a "just tell me". Unanswered items are not due. */
export function dueCounts(docs: readonly AnswerDoc[]): Map<string, number> {
  const due = new Map<string, number>();
  for (const [setId, items] of attemptsByItem(docs)) {
    let n = 0;
    for (const list of items.values()) {
      const last = list.reduce((a, b) => (b.at > a.at ? b : a));
      if (last.correct !== true) n++;
    }
    due.set(setId, n);
  }
  return due;
}

/** First-try accuracy over the last 14 days, against the 14 before: only each item's first answer counts. */
export function accuracyLine(
  docs: readonly AnswerDoc[],
  now: number,
): Accuracy | null {
  const firsts: Try[] = [];
  for (const items of attemptsByItem(docs).values())
    for (const list of items.values()) {
      const first = list.reduce((a, b) => (b.at < a.at ? b : a));
      if (first.correct !== undefined) firsts.push(first);
    }
  const rate = (from: number, to: number) => {
    const w = firsts.filter((t) => t.at > from && t.at <= to);
    return w.length
      ? Math.round((100 * w.filter((t) => t.correct).length) / w.length)
      : null;
  };
  const cur = rate(now - WINDOW, now);
  if (cur === null) return null;
  const prev = rate(now - 2 * WINDOW, now - WINDOW);
  if (prev === null || prev === cur) return { text: `${cur}%` };
  return { text: `${cur}%, ${cur > prev ? "up" : "down"} from ${prev}%` };
}
