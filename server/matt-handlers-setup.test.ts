import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

export async function setup() {
  const DB = sqliteD1();
  for (const f of ["0000_baseline"])
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
  /** A note as the editor sees it (title and blocks), read from its row. */
  const note = async (id: string) => {
    const r = await DB.prepare("SELECT title, body FROM notes WHERE id = ?")
      .bind(id)
      .first<{ title: string; body: string }>();
    return r
      ? ({ ...JSON.parse(r.body), title: r.title } as Record<string, any>)
      : null;
  };
  return { DB, call, note };
}
