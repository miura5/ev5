// A read-only PictureBucket over R2's S3 API (SigV4 by hand, no dependency), for the restore drill's picture check
// (§data.note-images). Needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID; without them
// r2Bucket returns null and the drill skips the check. Never run from CI without those secrets.
import { createHash, createHmac } from "node:crypto";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const hmac = (k, s) => createHmac("sha256", k).update(s).digest();
const enc = (s) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );

export function r2Bucket(bucket, env = process.env) {
  const {
    R2_ACCESS_KEY_ID: id,
    R2_SECRET_ACCESS_KEY: secret,
    CLOUDFLARE_ACCOUNT_ID: acct,
  } = env;
  if (!id || !secret || !acct) return null;
  const host = `${acct}.r2.cloudflarestorage.com`;
  const call = async (path, query) => {
    const qs = Object.entries(query)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${enc(k)}=${enc(v)}`)
      .join("&");
    const amz = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
    const day = amz.slice(0, 8);
    const hash = sha("");
    const canon = [
      "GET",
      path,
      qs,
      `host:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${amz}\n`,
      "host;x-amz-content-sha256;x-amz-date",
      hash,
    ].join("\n");
    const scope = `${day}/auto/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", amz, scope, sha(canon)].join("\n");
    const key = hmac(
      hmac(hmac(hmac(`AWS4${secret}`, day), "auto"), "s3"),
      "aws4_request",
    );
    const auth = `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${hmac(key, toSign).toString("hex")}`;
    const res = await fetch(`https://${host}${path}${qs ? `?${qs}` : ""}`, {
      headers: {
        "x-amz-date": amz,
        "x-amz-content-sha256": hash,
        authorization: auth,
      },
    });
    if (res.status === 404 && path.length > bucket.length + 2) return null;
    if (!res.ok) throw new Error(`R2 ${path}: ${res.status}`);
    return res;
  };
  return {
    async list({ prefix, cursor }) {
      const q = { "list-type": "2", prefix };
      if (cursor) q["continuation-token"] = cursor;
      const xml = await (await call(`/${bucket}`, q)).text();
      const objects = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => ({
        key: m[1].replace(/&amp;/g, "&"),
      }));
      return {
        objects,
        truncated: /<IsTruncated>true</.test(xml),
        cursor: /<NextContinuationToken>([^<]*)</.exec(xml)?.[1],
      };
    },
    async get(key) {
      const res = await call(
        `/${bucket}/${key.split("/").map(enc).join("/")}`,
        {},
      );
      return res && { arrayBuffer: () => res.arrayBuffer() };
    },
  };
}
