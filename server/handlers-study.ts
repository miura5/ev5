// Studying (CONTRACT §cmd.registry, PLAN §6.1 rule 10): the answer comes after the attempt, and "just tell me" is always
// there and always logged. An item is named `<set>/<item>`, or by its bare id when it is in one of Matt's own sets. An own
// set's attempt is an append-only `own_attempts` row; an ev4 set's is a new `answers` document (its set is never touched).
// Choice items are graded here; numeric items against their tolerance; an open answer is recorded for grading later.
import {
  itemKey,
  numberAnswer,
  itemType,
  parseSet,
  scoreAnswer,
  setKey,
} from "../domain/index.ts";
import { docsRepo, tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { eventKey, iso, put, rand } from "./handlers-edit.ts";

type Item = ReturnType<typeof parseSet>["items"][number];
type Found = { own: boolean; set: string; item: Item };

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
      own: true,
      set: own.set_id,
      item: { ...(own.body as object), id: own.id } as Item,
    };
  const doc = await docsRepo(x.db, { clock: x.clock }).get("sets", set);
  const item = doc && parseSet(doc.data).items.find((q) => q.id === itemId);
  if (!item) throw new CommandError(404, `no item ${id}`);
  return { own: false, set, item };
}

/** How many attempts the item has: an own set's rows, or the ev4 `answers` documents of the set that name it. */
async function attempts(x: HandlerCtx, f: Found): Promise<number> {
  if (f.own)
    return (await repo(x).ownAttempts.list(f.set)).filter(
      (a) => a.itemId === f.item.id,
    ).length;
  const { results } = await x.db
    .prepare("SELECT data FROM docs WHERE c = 'answers' AND id LIKE ?")
    .bind(`${f.set.replace(/[%_]/g, "")}-%`)
    .all<{ data: string }>();
  return results.filter((r) => {
    const d = JSON.parse(r.data) as {
      setId?: string;
      answers?: Record<string, unknown>;
    };
    return d.setId === f.set && !!d.answers?.[f.item.id];
  }).length;
}

/** The answer as indexes ("0" or "0,2"), or the number (and unit, if any) a number answer asks for. */
function grade(
  q: Item,
  answer: string,
): { correct?: boolean; score?: number; chosen?: number[]; value?: number } {
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

async function record(
  x: HandlerCtx,
  f: Found,
  how: "told" | { text: string; g: ReturnType<typeof grade> },
) {
  const now = x.clock();
  if (f.own) {
    const n = (await repo(x).ownAttempts.list(f.set)).filter(
      (a) => a.itemId === f.item.id,
    ).length;
    const body =
      how === "told"
        ? { text: "told" }
        : { ...how.g, ...(how.text ? { text: how.text } : {}) };
    const r = await repo(x).ownAttempts.append({
      setId: f.set,
      itemId: f.item.id,
      key: `a${n + 1}`,
      body,
    });
    if (!r.ok) throw new CommandError(409, "that attempt was already recorded");
    return `a${n + 1}`;
  }
  const key = eventKey(now, rand(x));
  const at = iso(now).slice(0, 19) + "Z";
  const entry =
    how === "told"
      ? { outcome: "told", at }
      : {
          ...(how.g.correct === undefined ? {} : { correct: how.g.correct }),
          at,
          ...(how.text ? { text: how.text.slice(0, 600) } : {}),
        };
  await put(
    x,
    "answers",
    `${f.set}-${key}`,
    {
      schema: 2,
      writer: "page",
      at,
      source: "v5/study",
      setId: f.set,
      answers: { [f.item.id]: { [key]: entry } },
    },
    null,
  );
  return key;
}

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
    const own = (await repo(x).setBook.read(setKey(i.id)))?.items ?? [];
    let ids = own.map((r) => r.id);
    if (!own.length) {
      const doc = await docsRepo(x.db, { clock: x.clock }).get("sets", i.id);
      if (!doc) throw new CommandError(404, `no set ${i.id}`);
      ids = parseSet(doc.data).items.map((q) => q.id);
    }
    return { client: true, set: i.id, items: ids.length };
  },

  "study.attempt": async (i: { id: string; answer: string }, _c, x) => {
    const f = await find(x, i.id);
    const open = itemType(f.item) === "open";
    if (open && !i.answer.trim())
      throw new CommandError(400, "write an answer first");
    const g = grade(f.item, i.answer);
    const key = await record(x, f, { text: open ? i.answer : "", g });
    // Only whether it was right comes back: the answer waits for study.reveal (the attempt comes first).
    return {
      id: i.id,
      key,
      ...(g.correct === undefined ? {} : { correct: g.correct }),
    };
  },

  "study.reveal": async (i: { id: string }, _c, x) => {
    const f = await find(x, i.id);
    if (!(await attempts(x, f)))
      throw new CommandError(409, "try it first, or use Just tell me");
    return { id: i.id, reveal: reveal(f.item) };
  },

  // Always available and always logged as its own attempt (outcome "told").
  "study.just_tell_me": async (i: { id: string }, _c, x) => {
    const f = await find(x, i.id);
    const key = await record(x, f, "told");
    return { id: i.id, key, told: true, reveal: reveal(f.item) };
  },

  "study.leave": async () => ({ client: true }),
};
