import assert from "node:assert/strict";
import { test } from "node:test";
import { ev4WorkerProblem, goodNote } from "../compat/index.ts";
import { workerNoteProblem } from "./worker-check.ts";

const note = goodNote();
const cases: [string, unknown, unknown][] = [
  ["a good note", note, null],
  ["an extra field", { ...note, html: "<b>x</b>" }, null],
  ["a missing title", { ...note, title: undefined }, null],
  ["a bad time", { ...note, at: "yesterday" }, null],
  ["a bad block type", { ...note, blocks: [{ type: "zz", runs: [] }] }, null],
  ["a null course", { ...note, course: null }, null],
  ["a bad course", { ...note, course: 5 }, null],
  ["a moved createdAt", { ...note, createdAt: "2026-11-03T00:00:00Z" }, note],
  ["an earlierOf added", { ...note, earlierOf: "n-abc" }, note],
  ["a bad earlierOf", { ...note, earlierOf: "x" }, null],
  ["a renamed title", { ...note, title: "Renamed" }, note],
  [
    "over the cap",
    {
      ...note,
      title: "x".repeat(300),
      blocks: Array.from({ length: 3000 }, () => ({
        type: "p",
        runs: [{ text: "y".repeat(100) }],
      })),
    },
    null,
  ],
  ["another collection", { anything: 1 }, null],
];

for (const [name, doc, prev] of cases)
  test(`worker check agrees with ajv: ${name}`, () => {
    const c = name === "another collection" ? "sets" : "notes";
    const a = workerNoteProblem(c, "n-a", doc as never, prev as never);
    const b = ev4WorkerProblem(c, "n-a", doc as never, prev as never);
    assert.equal(a === null, b === null, `${a} vs ${b}`);
  });

test("worker check refuses a note with a stated reason", () => {
  assert.match(
    String(
      workerNoteProblem("notes", "n-a", { ...note, html: 1 } as never, null),
    ),
    /does not fit its shape/,
  );
});
