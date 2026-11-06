// Matt's call A (2026-11-06): Again or Good on an open card is a self-rating, kept as one and never counted toward
// accuracy; a choice item is checked against its key whatever rating is sent, unless it was answered in words.
import test from "node:test";
import assert from "node:assert/strict";
import { tablesRepo } from "../data/index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

const openBody = {
  stem: "Why does fluid shift out of vessels in sepsis?",
  type: "open",
  modelAnswer: "Capillaries leak, so fluid moves into tissue.",
};

test("a rating on an open item is stored as a self-rating with no score", async () => {
  const { call, DB } = await setup();
  const set = (await call("set.create", { title: "Fluids" })).body.result.set
    .id as string;
  const r = await tablesRepo(DB, { clock: () => 1000 }).setBook.addItem({
    id: "item_open1",
    set_id: set,
    pos: 1,
    type: "open",
    body: openBody,
    objective_id: null,
    weak_spot_id: null,
    source_ref: null,
  });
  assert.equal(r.ok, true);
  const rated = await call("study.attempt", {
    id: `${set}/item_open1`,
    answer: "leaky capillaries",
    rating: "good",
    attempt: "att_self1",
  });
  assert.equal(rated.status, 200);
  assert.equal(rated.body.result.rating, "good");
  assert.equal(rated.body.result.correct, undefined);
  const row = await DB.prepare(
    "SELECT how, answer, score FROM attempts WHERE id = 'att_self1'",
  ).first<{ how: string; answer: string; score: number | null }>();
  assert.equal(row?.how, "self");
  assert.equal(row?.score, null);
  assert.deepEqual(JSON.parse(String(row?.answer)), {
    rating: "good",
    text: "leaky capillaries",
  });
  // a self-rating still counts as studied: the back can be shown
  assert.equal(
    (await call("study.reveal", { id: `${set}/item_open1` })).status,
    200,
  );
});

test("a rating on a choice item does not replace the check against its key", async () => {
  const { call, DB } = await setup();
  const set = (await call("set.create", { title: "Fluids" })).body.result.set
    .id as string;
  const q = "Which is normal sodium?\n- 100\n* 140\n- 180";
  const item = (await call("set.item_add", { set, text: q })).body.result.item
    .itemId as string;
  const r = await call("study.attempt", {
    id: item,
    answer: "0",
    rating: "good",
    attempt: "att_choice1",
  });
  assert.equal(r.body.result.correct, false);
  const row = await DB.prepare(
    "SELECT how, answer, score FROM attempts WHERE id = 'att_choice1'",
  ).first<{ how: string; answer: string; score: number }>();
  assert.deepEqual([row?.how, row?.score], ["chose", 0]);
  assert.deepEqual(JSON.parse(String(row?.answer)), { chosen: [0] });
  // answered in words, there is nothing to check: the rating is kept as a self-rating, never a score
  const words = {
    id: item,
    answer: "the middle one",
    rating: "good",
    attempt: "att_words1",
  };
  const w = await call("study.attempt", words);
  assert.equal(w.body.result.correct, undefined);
  const self = await DB.prepare(
    "SELECT how, score FROM attempts WHERE id = 'att_words1'",
  ).first<{ how: string; score: number | null }>();
  assert.deepEqual([self?.how, self?.score], ["self", null]);
  // with no rating, an answer that names no option is still refused
  const bare = { id: item, answer: "the middle one" };
  assert.equal((await call("study.attempt", bare)).status, 400);
});
