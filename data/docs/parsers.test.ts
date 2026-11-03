import test from "node:test";
import assert from "node:assert/strict";
import { registerProtocolSuite } from "../compat/index.ts";
import { SAMPLES } from "../compat/samples/writes.ts";
import { DOMAIN_PARSERS } from "./parsers.ts";
import { docsRepo } from "./repo.ts";
import { fakeD1 } from "./fake-d1.ts";

// The protocol suite, over the D1 repository with every domain parser wired.
registerProtocolSuite(
  "d1 repository with domain parsers",
  (clock) => docsRepo(fakeD1(), { clock, parsers: DOMAIN_PARSERS }),
  test,
);

for (const c of Object.keys(DOMAIN_PARSERS)) {
  const samples = SAMPLES[c];
  if (!samples) continue;
  for (const s of samples.valid) {
    test(`${c}: valid sample "${s.name}" parses`, () => {
      assert.doesNotThrow(() => DOMAIN_PARSERS[c]!(s.doc));
    });
    test(`${c}: valid sample "${s.name}" saves`, async () => {
      const repo = docsRepo(fakeD1(), { clock: () => 1_800_000_000_000, parsers: DOMAIN_PARSERS });
      const r = await repo.save(c, s.id ?? "d1", JSON.stringify(s.doc), null);
      assert.ok(r.ok, JSON.stringify(r));
    });
  }
}
