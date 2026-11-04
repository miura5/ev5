import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { startSession } from "./lifecycle.ts";

// OPEN: ev4's sessions schema allows source "Study Watch" | "E.V. Home" only, while validateWrite wants a
// v5 source on a create. Until the build manager decides which gives way, the start write fails on exactly that line.
test("a session start differs from what ev4 accepts only in the source rule", () => {
  const w = startSession({
    id: "s-20261104-100000",
    key: "page-20261104-100000",
    at: "2026-11-04T10:00:00Z",
    noteId: "n-20261104-100000-abcdef123456",
    topic: "Cardiac output",
  } as never);
  const v = validateWrite("sessions", w.data);
  expect(v.ok).toBe(false);
  expect(v.ok ? [] : v.errors.map((e) => e.split(":")[0])).toEqual(["/source"]);
});
