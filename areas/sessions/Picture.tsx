import { useEffect, useState } from "react";
import { api, readToken } from "../../commands/client.ts";
import { IMG_KEY } from "../../domain/index.ts";

/** A stored note picture, fetched with the app token (the Worker keeps it owner-only, §data.note-images); the word Image only until it loads or when it can't. */
export function Picture({ k, alt }: { k?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!k || !IMG_KEY.test(k)) return;
    let live = true;
    api(k, readToken())
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null)
      .then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [k]);
  if (url) return <img src={url} alt={alt ?? "Picture"} />;
  return <span>{alt ? `Image · ${alt}` : "Image"}</span>;
}
