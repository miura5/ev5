// /api/v1/note-images: note pictures in the environment's R2 bucket under note-images/ (CONTRACT §data.note-images).
// Auth is applied by index.ts; only the app token's scope reaches this prefix (auth.ts SCOPES).
//   PUT /note-images/<name>   raw picture bytes, stored under note-images/<name>; 400 on a malformed key, 413 when too big
//   GET /note-images/<name>   the picture, 404 when absent
// The key format is the one domain/note's IMG_KEY holds (not exported from its index, so repeated here).
import { Hono } from "hono";
import type { AuthVars } from "./auth.ts";

export interface R2Like {
  put(
    key: string,
    value: ArrayBuffer,
    o?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
  } | null>;
}

export interface ImageRoutesEnv {
  /** Unbound until the staging API token can use R2 (Matt's step); the routes answer 503 meanwhile. */
  IMAGES?: R2Like;
}

const KEY = /^note-images\/[A-Za-z0-9]{16,64}\.(png|jpg|webp|gif)$/;
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

const typeOf = (key: string) =>
  TYPES[key.slice(key.lastIndexOf(".") + 1)] as string;

imageRoutes.put("/note-images/:name", async (c) => {
  const key = `note-images/${c.req.param("name")}`;
  if (!KEY.test(key)) return c.json({ error: "malformed picture key" }, 400);
  if (!c.env.IMAGES) return c.json({ error: "picture storage is not set up" }, 503);
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_IMAGE)
    return c.json({ error: "picture is over 5 MB" }, 413);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) return c.json({ error: "empty picture" }, 400);
  if (bytes.byteLength > MAX_IMAGE)
    return c.json({ error: "picture is over 5 MB" }, 413);
  await c.env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: typeOf(key) },
  });
  return c.json({ key });
});

imageRoutes.get("/note-images/:name", async (c) => {
  const key = `note-images/${c.req.param("name")}`;
  if (!KEY.test(key)) return c.json({ error: "malformed picture key" }, 400);
  if (!c.env.IMAGES) return c.json({ error: "picture storage is not set up" }, 503);
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.json({ error: "not found" }, 404);
  return new Response(obj.body, {
    headers: {
      // The type comes from the key, never from what the caller sent; nosniff keeps a browser from guessing otherwise.
      "content-type": typeOf(key),
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
});
