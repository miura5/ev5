import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (f: string): string => fs.readFileSync(new URL(f, root), "utf8");

test("staging and live apply data/migrations the same way, and the config names that folder", () => {
  assert.match(read("wrangler.jsonc"), /"migrations_dir": "data\/migrations"/);
  for (const w of ["staging", "live"]) {
    assert.match(read(`.github/workflows/${w}.yml`), /d1 migrations apply "\$(?:NAME|DB)" --remote/);
  }
});

test("the staging workflow applies the migrations, then verifies them", () => {
  const yml = read(".github/workflows/staging.yml");
  assert.match(
    yml,
    /d1 migrations apply "\$NAME" --remote/,
  );
  assert.match(yml, /verify-staging-schema\.mjs/);
  const migrations = fs
    .readdirSync(new URL("data/migrations/", root))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  assert.ok(migrations.length >= 4);
  assert.equal(
    read("data/staging/schema.sql"),
    migrations.map((m) => read(`data/migrations/${m}`)).join("\n"),
  );
});
