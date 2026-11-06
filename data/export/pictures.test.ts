import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPictures, type PictureBucket } from "./pictures.ts";
import type { Row } from "./index.ts";

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const bucketOf = (m: Record<string, string>): PictureBucket => ({
  list: async () => ({
    objects: Object.keys(m).map((key) => ({ key })),
    truncated: false,
  }),
  get: async (k) => (k in m ? { arrayBuffer: async () => bytes(m[k]!) } : null),
});
const row = async (id: string, body: string): Promise<Row> => ({
  id: `file_${id}`,
  kind: "note_image",
  r2_key: `note-images/${id}.png`,
  size: bytes(body).byteLength,
  sha256: hex(await crypto.subtle.digest("SHA-256", bytes(body))),
  deleted_at: null,
});

test("matching pictures check clean", async () => {
  const r = await checkPictures(
    [await row("a", "one")],
    bucketOf({ "note-images/a.png": "one" }),
  );
  assert.deepEqual(r, { problems: [], orphans: [], checked: 1 });
});

test("a missing object, changed bytes and an orphan are each reported", async () => {
  const r = await checkPictures(
    [await row("a", "one"), await row("b", "two"), await row("c", "three")],
    bucketOf({
      "note-images/b.png": "twX",
      "note-images/c.png": "three",
      "note-images/z.png": "stray",
    }),
  );
  assert.equal(r.checked, 1);
  assert.deepEqual(r.problems, [
    "picture file_a: no object at note-images/a.png",
    "picture file_b: the SHA-256 differs",
  ]);
  assert.deepEqual(r.orphans, ["picture note-images/z.png: no files row"]);
});
