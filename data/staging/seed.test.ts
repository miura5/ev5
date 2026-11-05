import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOMAIN_PARSERS } from "../docs/parsers.ts";
import { checkedDocsRepo } from "../docs/checked.ts";
import { fakeD1 } from "../docs/fake-d1.ts";

// Collections in the seed that have no domain parser, with the reason each one is only checked by ev4's Worker check.
const NO_PARSER: Record<string, string> = {
  ideas: "ideas has no domain entity yet; only ev4's Worker check applies",
};

// The seed's INSERT rows: ('c', 'id', '<json>', at, v). Single quotes inside the JSON would be doubled.
function seedRows() {
  const sql = readFileSync(new URL("./seed.sql", import.meta.url), "utf8");
  const re = /\('([^']*)', '([^']*)', '((?:[^']|'')*)', (\d+), (\d+)\)/g;
  return [...sql.matchAll(re)].map((m) => ({
    c: m[1]!,
    id: m[2]!,
    data: m[3]!.replaceAll("''", "'"),
    at: Number(m[4]),
    v: Number(m[5]),
  }));
}

test("the seed has rows", () => {
  assert.ok(seedRows().length >= 4);
});

test("every seed document is read by the repository and parses", async () => {
  const db = fakeD1();
  for (const r of seedRows()) db.docs.set(`${r.c}\n${r.id}`, r);
  const repo = checkedDocsRepo(db, { clock: () => 1_800_000_000_000, parsers: DOMAIN_PARSERS });
  for (const r of seedRows()) {
    const doc = await repo.get(r.c, r.id);
    assert.ok(doc, `${r.c}/${r.id} is read back`);
    const parse = Object.hasOwn(DOMAIN_PARSERS, r.c) ? DOMAIN_PARSERS[r.c] : undefined;
    if (parse) assert.doesNotThrow(() => parse(doc.data), `${r.c}/${r.id} parses`);
    else assert.ok(NO_PARSER[r.c], `${r.c} has no parser and no stated reason`);
  }
});

test("a seed document is written back through the checked repository", async () => {
  const repo = checkedDocsRepo(fakeD1(), { clock: () => 1_800_000_000_000, parsers: DOMAIN_PARSERS });
  for (const r of seedRows()) {
    const res = await repo.save(r.c, r.id, r.data, null);
    assert.ok(res.ok, `${r.c}/${r.id}: ${JSON.stringify(res)}`);
  }
});
