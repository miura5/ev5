import { expect, test } from "vitest";
import {
  parseFileRow,
  parsePinTableRow,
  parsePlanItemTableRow,
  parsePlanTableRow,
  parseRepeatRow,
  parseSettingRow,
  planBodySchema,
} from "./index.ts";

const D = { at: 1_762_300_800_000, v: 1, deleted_at: null };
const plan = {
  id: "plan_1",
  goal_id: "goal_1",
  job_id: null,
  state: "in_force",
  title: null,
  from_day: "2026-11-06",
  to_day: "2026-11-20",
  summary: "Two weeks",
  ...D,
};
const item = {
  id: "pli_1",
  plan_id: "plan_1",
  day: "2026-11-07",
  pos: 1,
  title: "Key drills",
  minutes: 30,
  time: null,
  origin: "plan",
  linked_kind: null,
  linked_id: null,
  repeat_id: null,
  done_at: null,
  ...D,
};

test("plans: state, ordered days, prefixed id", () => {
  expect(parsePlanTableRow(plan).state).toBe("in_force");
  expect(() => parsePlanTableRow({ ...plan, state: "approved" })).toThrow();
  expect(() => parsePlanTableRow({ ...plan, to_day: "2026-11-01" })).toThrow();
  expect(() => parsePlanTableRow({ ...plan, id: "pli_1" })).toThrow();
  expect(() => parsePlanTableRow({ ...plan, exam_id: "x" })).toThrow();
});

test("plan_items: origin, linked pair", () => {
  expect(parsePlanItemTableRow(item).minutes).toBe(30);
  expect(
    parsePlanItemTableRow({ ...item, origin: "user", plan_id: null }).plan_id,
  ).toBeNull();
  expect(() =>
    parsePlanItemTableRow({ ...item, origin: "matt", plan_id: null }),
  ).toThrow();
  expect(() => parsePlanItemTableRow({ ...item, plan_id: null })).toThrow();
  expect(() =>
    parsePlanItemTableRow({ ...item, linked_kind: "note" }),
  ).toThrow();
  expect(() =>
    parsePlanItemTableRow({ ...item, linked_kind: "pin", linked_id: "x" }),
  ).toThrow();
  expect(() => parsePlanItemTableRow({ ...item, time: "9am" })).toThrow();
});

test("repeats: rule is JSON, ends after it starts", () => {
  const rep = {
    id: "rep_1",
    title: "Flashcards",
    minutes: 15,
    time: "07:30",
    rule: { every: "day" },
    from_day: "2026-11-06",
    to_day: null,
    linked_kind: null,
    linked_id: null,
    ...D,
  };
  expect(parseRepeatRow(rep).rule).toEqual({ every: "day" });
  expect(() => parseRepeatRow({ ...rep, to_day: "2026-11-01" })).toThrow();
  expect(() => parseRepeatRow({ ...rep, id: "plan_1" })).toThrow();
});

test("pins, settings and files: prefixed ids, v, strict", () => {
  const pin = {
    id: "pin_1",
    target_kind: "notes",
    target_id: "note_1",
    pos: 1,
    ...D,
  };
  expect(parsePinTableRow(pin).target_kind).toBe("notes");
  expect(() => parsePinTableRow({ ...pin, target_c: "notes" })).toThrow();
  expect(parseSettingRow({ key: "hourly", value: 5, at: 1, v: 1 }).value).toBe(
    5,
  );
  expect(() => parseSettingRow({ key: "hourly", value: 5, at: 1 })).toThrow();
  const file = {
    id: "file_1",
    kind: "note_image",
    type: "image/png",
    size: 10,
    sha256: "a".repeat(64),
    r2_key: "note/1.png",
    owner_kind: "note",
    owner_id: "note_1",
    ...D,
  };
  expect(parseFileRow(file).size).toBe(10);
  expect(() => parseFileRow({ ...file, sha256: "zz" })).toThrow();
  expect(() => parseFileRow({ ...file, kind: "pdf" })).toThrow();
});

test("the plan body shape the job and the app share", () => {
  const ok = {
    summary: "s",
    tasks: [{ date: "2026-11-07", title: "t", minutes: 30 }],
  };
  expect(planBodySchema.parse(ok).tasks).toHaveLength(1);
  expect(() =>
    planBodySchema.parse({ ...ok, tasks: [{ ...ok.tasks[0], minutes: 5 }] }),
  ).toThrow();
  expect(() => planBodySchema.parse({ summary: "", tasks: [] })).toThrow();
});
