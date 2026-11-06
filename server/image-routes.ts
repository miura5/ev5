// /api/v1/note-images: note pictures in the environment's R2 bucket under note-images/ (CONTRACT §data.note-images).
// Auth is applied by index.ts; only the app token's scope reaches this prefix (auth.ts SCOPES).
//   PUT /note-images/<name>   raw picture bytes, stored under note-images/<name>; 400 on a malformed key, 413 when too big,
//                             409 when the key already holds a picture (never overwritten, CONTRACT §hard.data-never-lost)
//                             415 when the bytes' magic number or the Content-Type header disagrees with the key's type
//                            ; a files row (id, type, size, SHA-256, owner, §data.links) is written beside the bytes
//   GET /note-images/<name>   the picture, 404 when absent; served with CSP default-src 'none' and nosniff
// The key format is domain/note's IMG_KEY.
import { Hono } from "hono";
import { IMG_KEY } from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import type { AuthVars } from "./auth.ts";

export interface R2Like {
  put(
    key: string,
    value: ArrayBuffer,
    o?: {
      httpMetadata?: { contentType?: string };
      onlyIf?: { etagDoesNotMatch?: string };
    },
  ): Promise<unknown | null>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
  } | null>;
}

export interface ImageRoutesEnv {
  /** Unbound until the staging API token can use R2 (Matt's step); the routes answer 503 meanwhile. */
  IMAGES?: R2Like;
  /** The D1 database; a picture's files row goes here. Absent in tests of the bytes alone. */
  DB?: unknown;
}

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
/** One picture's ceiling, in bytes. */
export const MAX_IMAGE = 5 * 1024 * 1024;

export const imageRoutes = new Hono<{
  Bindings: ImageRoutesEnv;
  Variables: AuthVars;
}>();

/** True when the bytes start with the magic number of the declared type. */
export function matchesType(b: Uint8Array, type: string): boolean {
  const at = (off: number, sig: number[]) =>
    sig.every((x, i) => b[off + i] === x);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  switch (type) {
    case "image/png":
      return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return at(0, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return at(0, ascii("GIF87a")) || at(0, ascii("GIF89a"));
    case "image/webp":
      return at(0, ascii("RIFF")) && at(8, ascii("WEBP"));
    default:
      return false;
  }
}

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

const typeOf = (key: string) =>
  TYPES[key.slice(key.lastIndexOf(".") + 1)] as string;

imageRoutes.put("/note-images/:name", async (c) => {
  const key = `note-images/${c.req.param("name")}`;
  if (!IMG_KEY.test(key))
    return c.json({ error: "malformed picture key" }, 400);
  if (!c.env.IMAGES)
    return c.json({ error: "picture storage is not set up" }, 503);
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_IMAGE)
    return c.json({ error: "picture is over 5 MB" }, 413);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) return c.json({ error: "empty picture" }, 400);
  if (bytes.byteLength > MAX_IMAGE)
    return c.json({ error: "picture is over 5 MB" }, 413);
  const type = typeOf(key);
  const sent = c.req
    .header("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (
    !matchesType(new Uint8Array(bytes), type) ||
    (sent && sent !== type && sent !== "application/octet-stream")
  )
    return c.json(
      { error: "the picture's bytes or Content-Type do not match its type" },
      415,
    );
  // onlyIf etagDoesNotMatch "*" makes R2 refuse (null) when the key exists, as the nightly export does.
  const put = await c.env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: typeOf(key) },
    onlyIf: { etagDoesNotMatch: "*" },
  });
  if (put === null)
    return c.json({ error: "a picture with this key already exists" }, 409);
  if (c.env.DB) {
    // The files row (table design 2.12). The owner note is not known at upload (the picture comes first), so the row is
    // unclaimed until the orphan report matches it to the note that holds its key.
    const name = key.slice("note-images/".length);
    const saved = await tablesRepo(c.env.DB as never, {
      clock: () => Date.now(),
    }).files.save(
      {
        id: `file_${name.slice(0, name.lastIndexOf("."))}`,
        kind: "note_image",
        type,
        size: bytes.byteLength,
        sha256: hex(await crypto.subtle.digest("SHA-256", bytes)),
        r2_key: key,
        owner_kind: "unclaimed",
        owner_id: name,
      },
      null,
    );
    if (!saved.ok)
      return c.json(
        { error: "the picture's file row could not be saved" },
        500,
      );
  }
  return c.json({ key });
});

imageRoutes.get("/note-images/:name", async (c) => {
  const key = `note-images/${c.req.param("name")}`;
  if (!IMG_KEY.test(key))
    return c.json({ error: "malformed picture key" }, 400);
  if (!c.env.IMAGES)
    return c.json({ error: "picture storage is not set up" }, 503);
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.json({ error: "not found" }, 404);
  return new Response(obj.body, {
    headers: {
      // The type comes from the key, never from what the caller sent; nosniff keeps a browser from guessing otherwise.
      "content-type": typeOf(key),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
});
