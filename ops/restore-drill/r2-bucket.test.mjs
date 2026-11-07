import { test } from "vitest";
import assert from "node:assert/strict";
import { r2Bucket } from "./r2-bucket.mjs";

test("r2Bucket is null without credentials, so the drill skips the picture check", () => {
  assert.equal(r2Bucket("b", {}), null);
  assert.equal(
    r2Bucket("b", { R2_ACCESS_KEY_ID: "a", CLOUDFLARE_ACCOUNT_ID: "c" }),
    null,
  );
});
