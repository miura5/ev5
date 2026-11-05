// Every model prompt is neutral text for any subject (§what.framing) and names no person: no subject's framing and no
// personal name may come back into a prompt.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASK_SYSTEM } from "./ask-chat.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const prompts: Record<string, string> = {
  "jobs/practice-set/prompt.md": read("../jobs/practice-set/prompt.md"),
  "jobs/study-plan/prompt.md": read("../jobs/study-plan/prompt.md"),
  "jobs/study-plan/changes-prompt.md": read("../jobs/study-plan/changes-prompt.md"),
  "server/ask-chat.ts ASK_SYSTEM": ASK_SYSTEM,
};
const SUBJECT = /nursing|nclex|clinical|patient|dosage|\bmatt\b/i;

test("no prompt carries a subject's framing or a person's name", () => {
  for (const [name, text] of Object.entries(prompts)) {
    assert.ok(text.length > 0, `${name} is empty`);
    assert.doesNotMatch(text, SUBJECT, name);
  }
});

test("no prompt keeps a placeholder for code to fill", () => {
  for (const [name, text] of Object.entries(prompts)) assert.doesNotMatch(text, /\{\{[^}]*\}\}/, name);
});
