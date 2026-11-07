import { test } from "vitest";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadChart } from "./chart.ts";
import { lintChart } from "./lint.ts";

/** ev4's Chart as carried; loaded in memory only, never written. */
const CARRIED = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures-ev4",
);
const scratch = (): string => CARRIED;

test("lint fails a live task whose milestone is not Phase 0 to 7, after-cutover or Inbox", () => {
  const rec = loadChart(scratch());
  const t = rec.tasks[0] as { milestone: string; id: string };
  for (const ok of ["Phase 0", "Phase 7", "after-cutover", "Inbox"]) {
    t.milestone = ok;
    assert.ok(
      !lintChart(rec).some((f) => f.check === "bad-milestone" && f.id === t.id),
      ok,
    );
  }
  for (const bad of ["5", "v5 P5", "Phase 8", "Ops"]) {
    t.milestone = bad;
    assert.ok(
      lintChart(rec).some(
        (f) =>
          f.check === "bad-milestone" && f.id === t.id && f.level === "error",
      ),
      bad,
    );
  }
});

test("lint warns on a decision that only opens or closes a gate", () => {
  const rec = loadChart(scratch());
  const d = rec.decisions[0] as { title: string; id: string };
  d.title = "Gate 5 passed: all journeys pass";
  assert.ok(
    lintChart(rec).some(
      (f) => f.check === "gate-decision" && f.id === d.id && f.level === "warn",
    ),
  );
  d.title = "Gate 5 journeys are listed in PLAN, not guessed";
  assert.ok(
    !lintChart(rec).some((f) => f.check === "gate-decision" && f.id === d.id),
  );
});
