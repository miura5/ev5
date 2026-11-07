import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "vitest";

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
});

test("only the staging rebuild deletes a D1: ev5-staging, on demand, before the create", () => {
  const yml = read(".github/workflows/staging.yml");
  const deletes = [...yml.matchAll(/d1 delete (\S+)/g)].map((m) => m[1]);
  assert.deepEqual(deletes, ["ev5-staging"]);
  assert.match(yml, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.rebuild \}\}\n(?:\s+#.*\n)?\s+working-directory: \$\{\{ runner\.temp \}\}\n\s+run: npx --yes \$WRANGLER d1 delete ev5-staging -y/);
  assert.ok(yml.indexOf("d1 delete") < yml.indexOf("d1 create"));
  for (const f of fs.readdirSync(new URL(".github/workflows/", root)).filter((n) => n !== "staging.yml"))
    assert.doesNotMatch(read(`.github/workflows/${f}`), /d1 delete/, f);
});

test("staging is seeded through the commands after the deploy and its secrets, never by SQL", () => {
  const yml = read(".github/workflows/staging.yml");
  assert.doesNotMatch(yml, /d1 execute[^\n]*--file/);
  const seed = yml.indexOf("node data/staging/seed.ts");
  assert.ok(seed > yml.indexOf("secret bulk"), "the seed runs after the Worker's secrets");
  assert.match(yml, /SEED_TOKEN: \$\{\{ secrets\.TOKEN_APP_STAGING \}\}/);
});
