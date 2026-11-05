import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCourseTable } from "../domain/index.ts";
import { askSystem } from "./ask-chat.ts";
import { framePrompt } from "./frame-prompt.ts";

const rule = {
  canvasId: 1,
  status: "active",
  examKinds: ["unit"],
  reviewKinds: [],
  examDayKinds: [],
  scoredKinds: [],
  calendarDayKinds: [],
  dayBudget: "shared",
  library: [{ module: "x", kind: "y" }],
};
const table = parseCourseTable({
  Nurs: { ...rule, nursing: true, default: true },
  Chem: { ...rule, exams: "unit tests and a lab practical" },
});
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const prompts = {
  practice: read("../jobs/practice-set/prompt.md"),
  plan: read("../jobs/study-plan/prompt.md"),
  changes: read("../jobs/study-plan/changes-prompt.md"),
};

test("a nursing course keeps the nursing wording in every prompt", () => {
  assert.match(framePrompt(table, prompts.practice, "Nurs"), /one nursing student[\s\S]*NCLEX-style/);
  assert.match(framePrompt(table, prompts.plan, "Nurs"), /one nursing student's exam/);
  assert.match(framePrompt(table, prompts.changes, "Nurs"), /one nursing student/);
});

test("another course and an unknown course get no nursing wording", () => {
  for (const course of ["Chem", null]) {
    for (const p of Object.values(prompts)) {
      const out = framePrompt(table, p, course);
      assert.doesNotMatch(out, /nursing|NCLEX|NUR 112|BIO 201|\{\{/i);
    }
  }
  assert.match(framePrompt(table, prompts.practice, "Chem"), /one student of Chem[\s\S]*Write Chem exam-style questions/);
  assert.match(framePrompt(table, prompts.plan, null), /one student's exam/);
});

test("Ask E.V. names nursing school only for a nursing course", () => {
  assert.match(askSystem(table, "Nurs"), /for nursing school/);
  assert.match(askSystem(table, "Chem"), /for Chem\./);
  assert.doesNotMatch(askSystem(table, null), /nursing/);
  assert.doesNotMatch(askSystem(table, "Chem"), /nursing/);
});
