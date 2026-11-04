import { api, readToken } from "../../../commands/client.ts";
import { IMG_KEY } from "../../../domain/index.ts";

// Note pictures (CONTRACT §data.note-images): the Worker keeps them in R2 under note-images/ for the owner only. The
// editor sends a pasted or dropped picture to PUT /api/v1/note-images/<name> and shows a stored one from
// GET /api/v1/note-images/<name> as a blob URL, because the app token has to ride in a header.
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const NO_STORAGE = "Picture storage isn't set up yet";
export const UPLOAD_FAILED = "The picture didn't upload";

/** A picture file the editor can keep (png, jpeg, webp, gif), or false. */
export const isPicture = (f: File) => f.type in EXT;

/** A fresh key: 24 random letters and digits and the extension the type names. */
export function newKey(type: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let name = "";
  for (const b of bytes) name += CHARS[b % CHARS.length];
  return `note-images/${name}.${EXT[type] ?? "png"}`;
}

export type Upload = { ok: true; key: string } | { ok: false; message: string };

/** Send one picture; any failure comes back as a plain message and never throws. */
export async function uploadPicture(file: File): Promise<Upload> {
  if (!isPicture(file))
    return {
      ok: false,
      message: "Only png, jpg, webp and gif pictures can go in a note",
    };
  const key = newKey(file.type);
  try {
    const r = await api(key, readToken(), {
      method: "PUT",
      raw: { data: file, contentType: file.type },
    });
    if (r.ok) return { ok: true, key };
    return {
      ok: false,
      message: r.status === 503 ? NO_STORAGE : UPLOAD_FAILED,
    };
  } catch {
    return { ok: false, message: UPLOAD_FAILED };
  }
}

const shown = new Map<string, Promise<string | null>>();

/** A stored picture as a blob URL, or null when it can't be read (kept for the session, so a picture loads once). */
export function pictureUrl(key: string): Promise<string | null> {
  if (!IMG_KEY.test(key)) return Promise.resolve(null);
  let p = shown.get(key);
  if (!p) {
    p = api(key, readToken())
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null);
    shown.set(key, p);
    void p.then((u) => u ?? shown.delete(key));
  }
  return p;
}
