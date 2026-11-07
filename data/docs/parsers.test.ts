import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_PARSERS } from "./parsers.ts";
import { docsRepo } from "./repo.ts";
import { fakeD1 } from "./fake-d1.ts";

const AT = "2026-11-02T15:00:00Z";
// Small synthetic documents, one per kind, each valid under its domain parser.
const FIXTURES: Record<string, unknown> = {
  notes: {
    schema: 1,
    writer: "page",
    at: AT,
    createdAt: AT,
    title: "Preload",
    blocks: [
      {
        type: "p",
        runs: [{ text: "Stretch before ", b: true }, { text: "contraction." }],
      },
    ],
  },
  sets: {
    schema: 3,
    writer: "page",
    at: AT,
    source: "v5/test",
    kind: "drill",
    date: "2026-11-02",
    exam: null,
    items: [
      {
        id: "q1",
        type: "single",
        stem: "Which one is larger?",
        options: ["Two", "One"],
        correct: [0],
      },
    ],
    createdAt: AT,
  },
};

test("the registry names a domain parser for each docs kind with a domain entity", () => {
  assert.deepEqual(Object.keys(DOMAIN_PARSERS).sort(), [
    "exams",
    "notes",
    "objectives",
    "sessions",
    "sets",
  ]);
});

for (const [c, doc] of Object.entries(FIXTURES)) {
  test(`${c}: a valid document parses and saves through the gate`, async () => {
    assert.doesNotThrow(() => DOMAIN_PARSERS[c]!(doc));
    const repo = docsRepo(fakeD1(), { clock: () => 1_800_000_000_000 });
    const r = await repo.save(c, "d1", JSON.stringify(doc), null);
    assert.ok(r.ok, JSON.stringify(r));
  });
  test(`${c}: a document its parser refuses is not written`, async () => {
    const repo = docsRepo(fakeD1(), { clock: () => 1_800_000_000_000 });
    const r = await repo.save(
      c,
      "d1",
      JSON.stringify({ ...(doc as object), schema: 99 }),
      null,
    );
    assert.equal(!r.ok && r.status, 400);
    assert.equal(await repo.get(c, "d1"), null);
  });
}
