import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { createOutbox, memoryStore, type Transport } from "./index.ts";

// The same shape the Library writes (areas/library/answer.ts; shell may not import it): ev4 schema 2 `answers`.
const doc = {
  schema: 2,
  writer: "page",
  at: "2026-11-04T10:15:30Z",
  source: "v5/library",
  setId: "set-1",
  answers: {
    q1: {
      "page-20261104-101530-abc9": {
        correct: true,
        at: "2026-11-04T10:15:30Z",
        text: "filling",
      },
    },
  },
};

test("what queueAnswer sends on replay passes ev4's write check, as a create", async () => {
  const sent: { c: string; id: string; body: string; base: number | null }[] =
    [];
  const transport: Transport = {
    async put(c, id, body, base) {
      sent.push({ c, id, body, base });
      return { status: 200, version: 1 };
    },
    async get() {
      return { status: 404 };
    },
  };
  const box = createOutbox({ store: memoryStore(), transport });
  await box.queueAnswer("answers", "set-1-page-20261104-101530-abc9", doc);
  expect((await box.replay()).sent).toBe(1);
  expect(sent).toHaveLength(1);
  expect(sent[0].base).toBeNull();
  expect(validateWrite(sent[0].c, JSON.parse(sent[0].body))).toEqual({
    ok: true,
  });
});
