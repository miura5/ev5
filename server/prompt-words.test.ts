// Every model prompt and every tool description E.V. reads is neutral text for any learner (§what.framing): no subject's
// framing, no personal name, no "student", and no school-shaped names for E.V.'s jobs may come back into one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASK_SYSTEM } from "./ask-chat.ts";
import {
  GRADE_SYSTEM,
  gradePrompt,
  practiceSetHandlers,
} from "../jobs/index.ts";
import type { ModelCall } from "../jobs/index.ts";
import { tools } from "../commands/index.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

/** The practice user message as the job builds it, captured from the model call the call step makes. */
async function practiceMessage(variant: string): Promise<string> {
  const sent: string[] = [];
  const call: ModelCall = async (req) => {
    sent.push(req.messages.map((m) => m.content).join("\n"));
    return {
      stopReason: "end_turn",
      text: "{}",
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  };
  const store = {
    put: async () => "",
    get: async () => {
      throw new Error("unused");
    },
    save: async () => {},
  };
  const input = {
    variant,
    targetId: "set-1",
    count: 3,
    objectives: ["Name the parts"],
    excerpts: [{ id: "x1", text: "A part." }],
  };
  const step = practiceSetHandlers({ store, call, system: "" }).call!;
  const ctx = {
    jobId: "j",
    instanceId: "j",
    step: "call",
    attempt: 1,
    input,
    prior: {},
    reserve: async () => {},
    spend: async () => {},
  };
  await step(ctx).catch(() => undefined);
  assert.match(
    sent[0] ?? "",
    /^Write /,
    `the ${variant} call step sent no request to write`,
  );
  return sent[0]!;
}

async function prompts(): Promise<Record<string, string>> {
  const out: Record<string, string> = {
    "jobs/practice-set/prompt.md": read("../jobs/practice-set/prompt.md"),
    "jobs/prep-plan/prompt.md": read("../jobs/prep-plan/prompt.md"),
    "jobs/prep-plan/changes-prompt.md": read(
      "../jobs/prep-plan/changes-prompt.md",
    ),
    "server/ask-chat.ts ASK_SYSTEM": ASK_SYSTEM,
    "jobs/grade GRADE_SYSTEM": GRADE_SYSTEM,
    "jobs/grade gradePrompt": gradePrompt({
      question: "Q",
      reference: "R",
      answer: "A",
    }),
    "jobs/grade gradePrompt, no reference": gradePrompt({
      question: "Q",
      reference: "",
      answer: "A",
    }),
    "practice set message, practice": await practiceMessage("practice"),
    "practice set message, full_run": await practiceMessage("full_run"),
  };
  const list = tools();
  assert.ok(list.length > 0, "E.V. has no tools");
  for (const t of list) out[`tool ${t.name}`] = t.description;
  return out;
}

const REFUSED: [string, RegExp][] = [
  [
    "a subject's framing or a person's name",
    /nursing|nclex|clinical|patient|dosage|\bmatt\b/i,
  ],
  ["the student", /\bstudents?\b/i],
  ["mock exam", /mock exam/i],
  ["exam-style", /exam-style/i],
  ["study plan", /study plan/i],
];

test("no prompt or tool description carries a subject's framing, a name or a school-shaped word", async () => {
  const problems: string[] = [];
  for (const [name, text] of Object.entries(await prompts())) {
    assert.ok(text.length > 0, `${name} is empty`);
    for (const [what, re] of REFUSED) {
      const hit = re.exec(text);
      if (hit) problems.push(`${name}: ${what} ("${hit[0]}")`);
    }
  }
  assert.deepEqual(problems, []);
});

test("no prompt keeps a placeholder for code to fill", async () => {
  for (const [name, text] of Object.entries(await prompts()))
    assert.doesNotMatch(text, /\{\{[^}]*\}\}/, name);
});
