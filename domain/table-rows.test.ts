import { expect, test } from "vitest";
import {
  parseAttemptRow,
  parseCollectionRow,
  parseGoalRow,
  parseLinkRow,
  parseNoteTableRow,
  parseObjectiveTableRow,
  parseSessionEventRow,
  parseSessionTableRow,
  parseSetItemRow,
  parseSetItemVersionRow,
  parseSetTableRow,
  parseTalkRow,
  parseWeakSpotEventRow,
  parseWeakSpotTableRow,
} from "./index.ts";

const S = { at: 1_762_300_800_000, v: 1 };
const D = { ...S, deleted_at: null };

const goal = {
  id: "goal_1",
  collection_id: "col_1",
  title: "Midterm",
  kind: "midterm",
  date: "2026-11-20",
  status: "open",
  score: null,
  created_by: "user",
  ...D,
};
test("goals: date optional, score only when done, no Canvas columns, no user name", () => {
  expect(parseGoalRow(goal).kind).toBe("midterm");
  expect(parseGoalRow({ ...goal, date: null }).date).toBeNull();
  expect(() => parseGoalRow({ ...goal, score: 0.8 })).toThrow();
  expect(parseGoalRow({ ...goal, status: "done", score: 0.8 }).score).toBe(0.8);
  expect(() => parseGoalRow({ ...goal, canvas_id: "x" })).toThrow();
  expect(() => parseGoalRow({ ...goal, created_by: "matt" })).toThrow();
  expect(() => parseGoalRow({ ...goal, id: "obj_1" })).toThrow();
});

const link = {
  id: "link_1",
  from_kind: "note",
  from_id: "note_1",
  to_kind: "goal",
  to_id: "goal_1",
  by: "user",
  note: null,
  ...D,
};
test("links: only the allowed pairs, material kept out", () => {
  expect(parseLinkRow(link).to_kind).toBe("goal");
  expect(parseLinkRow({ ...link, from_kind: "objective" }).from_kind).toBe(
    "objective",
  );
  expect(parseLinkRow({ ...link, to_kind: "objective" }).to_kind).toBe(
    "objective",
  );
  expect(() => parseLinkRow({ ...link, from_kind: "material" })).toThrow();
  expect(() => parseLinkRow({ ...link, from_kind: "goal" })).toThrow();
  expect(() =>
    parseLinkRow({ ...link, from_kind: "objective", to_kind: "objective" }),
  ).toThrow();
});

const att = {
  id: "att_1",
  item_id: "item_1",
  item_v: 1,
  set_id: "set_1",
  session_id: null,
  source: "run",
  how: "chose",
  answer: [1],
  score: 1,
  answered_at: 5,
  ...S,
};
test("attempts: append-only, told and skipped are ungraded", () => {
  expect(parseAttemptRow(att).how).toBe("chose");
  expect(
    parseAttemptRow({ ...att, how: "told", answer: null, score: null }).score,
  ).toBeNull();
  expect(() => parseAttemptRow({ ...att, how: "told" })).toThrow();
  expect(() => parseAttemptRow({ ...att, v: 2 })).toThrow();
  expect(() => parseAttemptRow({ ...att, deleted_at: null })).toThrow();
  expect(() => parseAttemptRow({ ...att, score: 2 })).toThrow();
});

test("attempts: a self-rating keeps its rating and carries no score", () => {
  const self = { ...att, how: "self", answer: { rating: "good" }, score: null };
  expect(parseAttemptRow(self).score).toBeNull();
  expect(() => parseAttemptRow({ ...self, score: 1 })).toThrow();
  expect(() => parseAttemptRow({ ...self, answer: null })).toThrow();
  expect(() =>
    parseAttemptRow({ ...self, answer: { rating: "easy" } }),
  ).toThrow();
});

const talk = {
  id: "talk_1",
  chat_id: "c1",
  scope: "ask",
  session_id: null,
  context_kind: "note",
  context_id: "note_1",
  role: "user",
  text: "hi",
  cites: null,
  job_id: null,
  ...S,
};
test("talk: roles, context pair, session lines name their session", () => {
  expect(parseTalkRow(talk).role).toBe("user");
  expect(() => parseTalkRow({ ...talk, role: "matt" })).toThrow();
  expect(() => parseTalkRow({ ...talk, context_id: null })).toThrow();
  expect(() => parseTalkRow({ ...talk, scope: "session" })).toThrow();
});

test("collections: generic, no course facts, not its own parent", () => {
  const c = { id: "col_1", title: "A", parent_id: null, pos: 1, ...D };
  expect(parseCollectionRow(c).title).toBe("A");
  expect(() => parseCollectionRow({ ...c, parent_id: "col_1" })).toThrow();
  expect(() => parseCollectionRow({ ...c, canvas_id: "x" })).toThrow();
  expect(() => parseCollectionRow({ ...c, class_days: [] })).toThrow();
});

test("objectives: no goal pointer", () => {
  const o = {
    id: "obj_1",
    collection_id: "col_1",
    num: 1,
    text: "t",
    chapters: ["1"],
    source_ref: null,
    created_by: "ev",
    ...D,
  };
  expect(parseObjectiveTableRow(o).num).toBe(1);
  expect(() => parseObjectiveTableRow({ ...o, exam: "x" })).toThrow();
});

test("weak spots: no init_* or links, events need until for snooze", () => {
  const w = {
    id: "ws_1",
    collection_id: null,
    objective_id: "obj_1",
    topic: "t",
    kind: "concept",
    words: null,
    source_line: "a note",
    duplicate_of: null,
    proposed: 0,
    created_by: "ev",
    pre_read: 0,
    reading_due: null,
    ...D,
  };
  expect(parseWeakSpotTableRow(w).topic).toBe("t");
  expect(() => parseWeakSpotTableRow({ ...w, init_streak: 1 })).toThrow();
  expect(() => parseWeakSpotTableRow({ ...w, links: [] })).toThrow();
  const e = {
    id: "wse_1",
    weak_spot_id: "ws_1",
    type: "snooze",
    by: "user",
    note: null,
    objective_id: null,
    until: "2026-11-09",
    ...S,
  };
  expect(parseWeakSpotEventRow(e).until).toBe("2026-11-09");
  expect(() => parseWeakSpotEventRow({ ...e, until: null })).toThrow();
  expect(parseWeakSpotEventRow({ ...e, type: "seen", until: null }).type).toBe(
    "seen",
  );
});

test("sets, items and item versions", () => {
  const s = {
    id: "set_1",
    collection_id: null,
    kind: "adhoc",
    title: null,
    source_kind: "note",
    source_id: "note_1",
    created_by: "ev",
    job_id: null,
    focus: null,
    asked: null,
    ...D,
  };
  expect(parseSetTableRow(s).kind).toBe("adhoc");
  expect(() => parseSetTableRow({ ...s, source_id: null })).toThrow();
  expect(() => parseSetTableRow({ ...s, kind: "nope" })).toThrow();
  const i = {
    id: "item_1",
    set_id: "set_1",
    pos: 1,
    type: "single",
    body: { stem: "s", options: ["a", "b"], correct: [0] },
    objective_id: null,
    weak_spot_id: null,
    source_ref: null,
    ...D,
  };
  expect(parseSetItemRow(i).type).toBe("single");
  expect(() => parseSetItemRow({ ...i, type: "essay" })).toThrow();
  const ver = {
    id: "item_1@1",
    item_id: "item_1",
    item_v: 1,
    body: { stem: "old" },
    at: 3,
    v: 1,
  };
  expect(parseSetItemVersionRow(ver).item_v).toBe(1);
  expect(() => parseSetItemVersionRow({ ...ver, id: "item_1@2" })).toThrow();
});

test("sessions and their events", () => {
  const s = {
    id: "ses_1",
    kind: "note",
    note_id: "note_1",
    set_id: null,
    collection_id: null,
    day: "2026-11-06",
    status: "active",
    planned_min: 30,
    started_at: 1,
    ended_at: null,
    topic: null,
    clock: "writing",
    minutes: null,
    driver: { view: "note", at: 2 },
    ...D,
  };
  expect(parseSessionTableRow(s).status).toBe("active");
  expect(() => parseSessionTableRow({ ...s, kind: "skill" })).toThrow();
  expect(() => parseSessionTableRow({ ...s, day: "11/06" })).toThrow();
  const e = {
    id: "sese_1",
    session_id: "ses_1",
    type: "start",
    body: null,
    ...S,
  };
  expect(parseSessionEventRow(e).type).toBe("start");
  expect(() => parseSessionEventRow({ ...e, type: "comment" })).toThrow();
});

test("notes: block body, text, earlier_of", () => {
  const n = {
    id: "note_1",
    collection_id: null,
    title: "T",
    body: [{ t: "p", r: [] }],
    text: "x",
    earlier_of: null,
    ...D,
  };
  expect(parseNoteTableRow(n).text).toBe("x");
  expect(() => parseNoteTableRow({ ...n, earlier_of: "note_1" })).toThrow();
  expect(() => parseNoteTableRow({ ...n, id: "n-1" })).toThrow();
});
