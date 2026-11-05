import test from "node:test";
import assert from "node:assert/strict";
import { goodNote, registerProtocolSuite } from "../protocol/protocol-suite.ts";
import type { WriteProblem } from "../protocol/protocol.ts";
import { docsRepo } from "./repo.ts";
import { fakeD1 } from "./fake-d1.ts";

// The same suite the in-memory reference passes, run over the D1 repository and its gate.
registerProtocolSuite("d1 repository", (clock) => docsRepo(fakeD1(), { clock }), test);

// An extra write check on a kind with no domain parser, refusing any field it does not list.
const strict =
  (c: string, keys: string[]): WriteProblem =>
  (kind, _id, doc) => {
    if (kind !== c) return null;
    const extra = Object.keys(doc as object).find((k) => !keys.includes(k));
    return extra ? `unexpected field ${extra}` : null;
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

test("an extra write check runs on both write paths, and a refused batch writes nothing", async () => {
  const repo = docsRepo(fakeD1(), {
    clock: () => 1_800_000_000_000,
    problem: strict("scratch", ["n"]),
  });
  assert.ok((await repo.save("scratch", "s1", '{"n":1}', null)).ok);
  const bad = await repo.save("scratch", "s2", '{"n":1,"x":2}', null);
  assert.equal(!bad.ok && bad.status, 400);
  assert.equal(await repo.get("scratch", "s2"), null);
  const batch = await repo.batch([
    { op: "set", collection: "exams", doc_id: "e3", data: exam },
    { op: "set", collection: "scratch", doc_id: "s3", data: { nonsense: true } },
  ]);
  assert.equal(!batch.ok && batch.status, 400);
  assert.equal(await repo.get("exams", "e3"), null, "all or nothing");
});

test("the gate parses notes with the domain parser and keeps a note's identity write-once", async () => {
  const repo = docsRepo(fakeD1(), { clock: () => 1_800_000_000_000 });
  const note = goodNote();
  assert.ok((await repo.save("notes", "n-a", JSON.stringify(note), null)).ok);
  const extra = await repo.save("notes", "n-b", JSON.stringify({ ...note, html: "<b>x</b>" }), null);
  assert.match(!extra.ok ? extra.error : "", /^notes\/n-b does not parse/);
  const moved = await repo.save(
    "notes",
    "n-a",
    JSON.stringify({ ...note, createdAt: "2026-11-03T00:00:00Z" }),
    1,
  );
  assert.match(!moved.ok ? moved.error : "", /createdAt is written once/);
});

test("a write landing between the read and the batch is a 409 and nothing is written", async () => {
  const db = fakeD1();
  const repo = docsRepo(db, { clock: () => 1_800_000_000_000 });
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
  const repo = docsRepo(db, { clock: () => now, includeDeleted: true });
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

test("the gate: a bad row is refused on write; reads leave out a bad or deleted row; rename needs a title", async () => {
  const db = fakeD1();
  const bad: string[] = [];
  const repo = docsRepo(db, {
    clock: () => 1_800_000_000_000,
    onBad: (b) => bad.push(b.doc_id),
  });
  assert.equal(
    (
      await repo.save(
        "exams",
        "e1",
        JSON.stringify({ ...exam, score: 90 }),
        null,
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await repo.save(
        "weakspots",
        "w1",
        JSON.stringify({ ...spot, title: "x" }),
        null,
      )
    ).ok,
    false,
  );
  assert.ok((await repo.save("exams", "e2", JSON.stringify(exam), null)).ok);
  assert.ok((await repo.rename("exams", "e2", "Unit 4", 1)).ok);
  assert.equal(
    ((await repo.get("exams", "e2"))?.data as { title: string }).title,
    "Unit 4",
  );
  const good = {
    ...spot,
    schema: 2,
    topic: "t",
    objective: "E4-3",
    exam: "E4",
    course: "NUR 112",
    kind: "concept",
    addedBy: "test",
    initial: { streak: 0, nextDue: "2026-10-16", recurrence: 1, misses: 0 },
    events: {},
  };
  assert.ok(
    (await repo.save("weakspots", "w1", JSON.stringify(good), null)).ok,
  );
  const r = await repo.rename("weakspots", "w1", "x", 1);
  assert.equal(!r.ok && r.status, 400);
  assert.match(!r.ok ? r.error : "", /no title/);
  // A row that got in some other way is reported and left out of get and list.
  db.docs.set("exams\nbroken", {
    c: "exams",
    id: "broken",
    data: '{"nope":1}',
    at: 1,
    v: 1,
  });
  assert.equal(await repo.get("exams", "broken"), null);
  assert.deepEqual(
    (await repo.list("exams")).map((d) => d.id),
    ["e2"],
  );
  assert.deepEqual(bad, ["broken", "broken"]);
  // A deleted row is hidden until asked for.
  await repo.markDeleted("exams", "e2");
  assert.equal(await repo.get("exams", "e2"), null);
  assert.deepEqual(await repo.list("exams"), []);
  const all = docsRepo(db, { clock: () => 1, includeDeleted: true });
  assert.equal((await all.list("exams")).length, 1);
});
