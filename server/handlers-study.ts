// Studying (CONTRACT §cmd.registry, PLAN §6.1 rule 10): the answer comes after the attempt, and "just tell me" is always
// there and always logged. An item is named `<set>/<item>`, or by its bare id. Every attempt is one append-only
// `attempts` row (data/tables/attempts.ts, §data.item-versions); sets and items are rows of `sets` and `set_items`.
// Choice items are graded here; numeric items against their tolerance; a typed open answer is graded by the model
// (jobs/grade, CONTRACT §model.output, §model.ceilings) and its score is kept with the answer. Again or Good on an open
// card is a self-rating (how "self", no score): only checked answers count toward accuracy.
import { GRADE_MAX_ANSWER_CHARS } from "../jobs/index.ts";
import {
  itemKey,
  numberAnswer,
  itemType,
  parseSet,
  scoreAnswer,
  setKey,
  upgradeItem,
} from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { rowOf, type Entry, type Graded } from "./study-entry.ts";

type Item = ReturnType<typeof parseSet>["items"][number];
type Found = { set: string; item: Item };

const repo = (x: HandlerCtx) => tablesRepo(x.db, { clock: x.clock });

async function find(x: HandlerCtx, id: string): Promise<Found> {
  const slash = id.indexOf("/");
  if (slash < 0) {
    const { results } = await x.db
      .prepare(
        "SELECT set_id FROM set_items WHERE id = ? AND deleted_at IS NULL LIMIT 2",
      )
      .bind(itemKey(id))
      .all<{ set_id: string }>();
    if (results.length > 1)
      throw new CommandError(409, `${id} is in two sets; name it <set>/<item>`);
    if (!results.length) throw new CommandError(404, `no item ${id}`);
    return find(x, `${(results[0] as { set_id: string }).set_id}/${id}`);
  }
  const set = id.slice(0, slash);
  const itemId = id.slice(slash + 1);
  const own = (await repo(x).setBook.read(setKey(set)))?.items.find(
    (r) => r.id === itemKey(itemId),
  );
  if (own)
    return {
      set: own.set_id,
      item: { ...(upgradeItem(own.body) as object), id: own.id } as Item,
    };
  throw new CommandError(404, `no item ${id}`);
}

/** How many attempts the item has: the `attempts` rows that name it. */
async function attempts(x: HandlerCtx, f: Found): Promise<number> {
  const r = await x.db
    .prepare("SELECT COUNT(*) AS n FROM attempts WHERE item_id = ?")
    .bind(f.item.id)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** The answer as indexes ("0" or "0,2"), or the number (and unit, if any) a number answer asks for. */
function grade(q: Item, answer: string): Graded {
  const t = itemType(q);
  if (t === "open") return {};
  if (t === "numeric") {
    const given = numberAnswer(answer);
    if (!given || q.answer === undefined)
      throw new CommandError(400, "this item takes a number");
    return { value: given.value, correct: scoreAnswer(q, given).correct };
  }
  const chosen = answer
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  if (!chosen.length || chosen.some((n) => !Number.isInteger(n) || n < 0))
    throw new CommandError(
      400,
      "answer with the option numbers, like 0 or 0,2",
    );
  return { chosen, ...scoreAnswer(q, chosen) };
}

/** A choice or number answer checked against its key; null when it names no option or number and a rating came instead. */
function check(q: Item, answer: string, rated: boolean) {
  try {
    return grade(q, answer);
  } catch (e) {
    if (rated && e instanceof CommandError && e.status === 400) return null;
    throw e;
  }
}

async function record(x: HandlerCtx, f: Found, how: Entry, attemptId?: string) {
  // One attempts row; a retry that names the same id is a conflict, so the row is never doubled (§data.append-only).
  const id = attemptId ?? `att_${x.newId().replace(/-/g, "")}`;
  const r = await repo(x).attempts.record({
    id,
    item_id: f.item.id,
    set_id: f.set,
    session_id: null,
    source: "run",
    ...rowOf(itemType(f.item) === "open", how),
    answered_at: x.clock(),
  });
  if (!r.ok) throw new CommandError(409, "that attempt was already recorded");
  return id;
}

/** From this score a graded open answer counts as right. */
const PASS = 0.7;

/** The reference the grader reads: the model answer, then the key points, as plain text. */
const reference = (q: Item) =>
  [q.modelAnswer, ...(q.keyPoints ?? []).map((k) => `Key point: ${k.text}`)]
    .filter((s): s is string => typeof s === "string" && !!s)
    .join("\n");

const reveal = (q: Item) => ({
  correct: q.correct,
  answer: q.answer,
  unit: q.unit,
  rationales: q.rationales,
  modelAnswer: q.modelAnswer,
});

export const studyHandlers: Record<string, CommandHandler> = {
  // Opening the study view is the screen's; the server says what is in the set and where he left off.
  "study.start": async (i: { id: string }, _c, x) => {
    const read = await repo(x).setBook.read(setKey(i.id));
    if (!read) throw new CommandError(404, `no set ${i.id}`);
    return { client: true, set: i.id, items: read.items.length };
  },

  "study.attempt": async (
    i: {
      id: string;
      answer: string;
      rating?: "again" | "good";
      attempt?: string;
    },
    _c,
    x,
  ) => {
    const f = await find(x, i.id);
    const open = itemType(f.item) === "open";
    // A choice or number answer is checked against its key; a rating sent with it never replaces the check.
    const checked = open ? null : check(f.item, i.answer, !!i.rating);
    // Again or Good with nothing to check (an open card, or a choice card answered in words) is his own judgment: kept
    // as a self-rating, never a score, so it counts as studied but never toward accuracy (Matt's call A, 2026-11-06).
    if (i.rating && !checked) {
      const rating = { text: i.answer, rating: i.rating };
      const key = await record(x, f, rating, i.attempt);
      return { id: i.id, key, rating: i.rating };
    }
    if (open && !i.answer.trim())
      throw new CommandError(400, "write an answer first");
    let g = checked ?? grade(f.item, i.answer);
    let note: string | undefined;
    if (open) {
      if (i.answer.length > GRADE_MAX_ANSWER_CHARS)
        throw new CommandError(
          400,
          `that answer is over ${GRADE_MAX_ANSWER_CHARS} characters; shorten it to the key points`,
        );
      if (!x.grade) throw new CommandError(503, "grading is not available");
      const r = await x.grade({
        question: String(f.item.stem ?? ""),
        reference: reference(f.item),
        answer: i.answer,
      });
      g = { score: r.score, correct: r.score >= PASS };
      note = r.note;
    }
    const key = await record(
      x,
      f,
      { text: open ? i.answer : "", g },
      i.attempt,
    );
    // Only whether it was right comes back: the answer waits for study.reveal (the attempt comes first).
    return {
      id: i.id,
      key,
      ...(g.correct === undefined ? {} : { correct: g.correct }),
      ...(g.score === undefined ? {} : { score: g.score }),
      ...(note ? { note } : {}),
    };
  },

  "study.reveal": async (i: { id: string }, _c, x) => {
    const f = await find(x, i.id);
    if (!(await attempts(x, f)))
      throw new CommandError(409, "try it first, or use Just tell me");
    return { id: i.id, reveal: reveal(f.item) };
  },

  // Always available and always logged as its own attempt (outcome "told").
  "study.just_tell_me": async (i: { id: string; attempt?: string }, _c, x) => {
    const f = await find(x, i.id);
    const key = await record(x, f, "told", i.attempt);
    return { id: i.id, key, told: true, reveal: reveal(f.item) };
  },

  "study.leave": async () => ({ client: true }),
};
