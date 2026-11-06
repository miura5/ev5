import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

export async function setup() {
  const DB = sqliteD1();
  for (const f of [
    "0000_baseline",
    "0001_deletions",
    "0002_jobs_ceilings",
    "0003_collections_pins_own",
    "0004_ceiling_usage",
    "0006_tables",
  ])
    for (const stmt of readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    )
      .replace(/--.*$/gm, "")
      .split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const call = async (name: string, input: unknown) => {
    const r = await app.request(
      `/api/v1/commands/${name}`,
      {
        method: "POST",
        headers: { authorization: "Bearer app-t" },
        body: JSON.stringify({ input }),
      },
      env,
    );
    return { status: r.status, body: (await r.json()) as Record<string, any> };
  };
  const doc = async (c: string, id: string) => {
    const r = await DB.prepare("SELECT data FROM docs WHERE c = ? AND id = ?")
      .bind(c, id)
      .first<{ data: string }>();
    return r ? (JSON.parse(r.data) as Record<string, any>) : null;
  };
  /** A note as the editor sees it (title and blocks), read from its row. */
  const note = async (id: string) => {
    const r = await DB.prepare("SELECT title, body FROM notes WHERE id = ?")
      .bind(`note_${id}`)
      .first<{ title: string; body: string }>();
    return r
      ? ({ ...JSON.parse(r.body), title: r.title } as Record<string, any>)
      : null;
  };
  const put = (c: string, id: string, data: object) =>
    DB.prepare("INSERT INTO docs (c, id, data, at, v) VALUES (?, ?, ?, 1, 1)")
      .bind(c, id, JSON.stringify(data))
      .run();
  return { DB, call, doc, note, put };
}
