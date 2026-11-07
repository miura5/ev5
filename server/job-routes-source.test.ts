import test from "node:test";
import assert from "node:assert/strict";
import { input, setup } from "./job-routes-setup.test.ts";
import { putNoteRow } from "./sqlite-d1.test.ts";

test("a practice set asked from one note gathers only that note's passages", async () => {
  const { req, wf, db, started } = setup();
  await putNoteRow(db, "note_n9", "Verbs", "Spanish verbs: hablar means to speak.");
  const res = await req("POST", "/api/v1/jobs/practice-set", "fake-app", {
    input: {
      ...input,
      objectives: ["Vital signs"],
      source: { kind: "note", id: "note_n9" },
    },
  });
  assert.equal(res.status, 202);
  await wf.idle();
  assert.deepEqual(
    started[0]?.input.excerpts.map((e) => e.id),
    ["note_n9"],
  );
});
