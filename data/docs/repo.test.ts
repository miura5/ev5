import test from "node:test";
import assert from "node:assert/strict";
import { registerProtocolSuite } from "../compat/index.ts";
import { checkedDocsRepo } from "./checked.ts";
import { parsingProblem, type ParserRegistry } from "./registry.ts";
import { fakeD1 } from "./fake-d1.ts";

// The same suite the in-memory reference passes, run over the D1 repository (with only ev4's Worker check, as there).
registerProtocolSuite(
  "d1 repository",
  (clock) => checkedDocsRepo(fakeD1(), { clock }),
  test,
);

// Stand-ins for domain/exam's and domain/weak-spot's parsers (data may not import them until domain has an index).
const strict = (keys: string[]) => (raw: unknown) => {
  for (const k of Object.keys(raw as object))
    if (!keys.includes(k)) throw new Error(`unexpected field ${k}`);
};
const parsers: ParserRegistry = {
  exams: strict(["schema", "writer", "at", "source", "title", "kind"]),
  weakspots: strict(["schema", "writer", "at", "source"]),
};

const exam = {
  schema: 2,
  writer: "page",
  at: "2026-11-03T00:00:00Z",
  source: "v5/test",
  title: "Unit 3",
  kind: "unit",
};
const spot = {
  schema: 1,
  writer: "page",
  at: "2026-11-03T00:00:00Z",
  source: "v5/test",
};

test("collections in the parser registry are parsed before a write", async () => {
  const repo = checkedDocsRepo(fakeD1(), { clock: () => 1_800_000_000_000, parsers });
  assert.ok((await repo.save("exams", "e1", JSON.stringify(exam), null)).ok);
  const bad = await repo.save(
    "exams",
    "e2",
    JSON.stringify({ ...exam, score: 90 }),
    null,
  );
  assert.equal(!bad.ok && bad.status, 400);
  assert.equal(await repo.get("exams", "e2"), null);
  const batch = await repo.batch([
    { op: "set", collection: "exams", doc_id: "e3", data: exam },
    {
      op: "set",
      collection: "weakspots",
      doc_id: "w1",
      data: { ...spot, nonsense: true },
    },
  ]);
  assert.equal(!batch.ok && batch.status, 400);
  assert.equal(await repo.get("exams", "e3"), null, "all or nothing");
});

test("a collection without a parser passes the registry untouched", () => {
  assert.equal(parsingProblem({})("exams", "x", { anything: 1 }, null), null);
});

test("a write landing between the read and the batch is a 409 and nothing is written", async () => {
  const db = fakeD1();
  const repo = checkedDocsRepo(db, { clock: () => 1_800_000_000_000 });
  await repo.save("scratch", "a", '{"n":1}', null);
  await repo.save("scratch", "b", '{"n":1}', null);
  db.beforeBatch = () => void db.docs.get("scratch\nb")!.v++;
  const r = await repo.batch([
    {
      op: "update",
      collection: "scratch",
      doc_id: "a",
      data: { n: 2 },
      if_version: 1,
    },
    {
      op: "update",
      collection: "scratch",
      doc_id: "b",
      data: { n: 2 },
      if_version: 1,
    },
  ]);
  assert.equal(!r.ok && r.status, 409);
  assert.equal(
    (await repo.get("scratch", "a"))?.v,
    1,
    "the first entry was rolled back",
  );
});

test("markDeleted writes a deletions row and leaves the document where it is", async () => {
  const db = fakeD1();
  let now = 1_800_000_000_000;
  const repo = checkedDocsRepo(db, { clock: () => now });
  await repo.save("scratch", "gone", '{"n":1}', null);
  assert.equal(await repo.markDeleted("scratch", "nope"), false);
  assert.equal(await repo.markDeleted("scratch", "gone"), true);
  now += 1000;
  assert.equal(await repo.markDeleted("scratch", "gone"), true);
  assert.deepEqual(
    [...db.deletions.values()],
    [{ c: "scratch", id: "gone", at: now }],
  );
  assert.equal((await repo.get("scratch", "gone"))?.v, 1);
  assert.equal(db.docs.size, 1);
});
