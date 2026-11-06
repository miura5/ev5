import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { tablesRepo } from "../index.ts";
import { WriteRefused } from "./gate.ts";

type Arg = string | number | null;

function repo() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    /CREATE TABLE IF NOT EXISTS talk \([\s\S]*?\n\);/.exec(
      readFileSync(
        new URL("../migrations/0006_tables.sql", import.meta.url),
        "utf8",
      ),
    )![0],
  );
  const db = {
    prepare: (t: string) => {
      let a: Arg[] = [];
      const st = {
        bind: (...v: Arg[]) => ((a = v), st),
        first: async () => sql.prepare(t).get(...a) ?? null,
        all: async () => ({ results: sql.prepare(t).all(...a) }),
        run: async () => ({
          meta: { changes: Number(sql.prepare(t).run(...a).changes) },
        }),
      };
      return st;
    },
  };
  let now = 100;
  return tablesRepo(db as never, { clock: () => now++ }).talkBook;
}

const line = (id: string, role: "user" | "ev", chat = "c1") => ({
  id,
  chat_id: chat,
  scope: "ask" as const,
  session_id: null,
  context_kind: null,
  context_id: null,
  role,
  text: id,
  cites: null,
  job_id: null,
});

test("talk lines are appended, read in order, capped by last, and never doubled", async () => {
  const t = repo();
  assert.equal(await t.say(line("talk_1", "user")), true);
  assert.equal(await t.say(line("talk_2", "ev")), true);
  assert.equal(await t.say(line("talk_1", "user")), false);
  await t.say(line("talk_3", "user", "c2"));
  assert.deepEqual(
    (await t.chat("c1")).map((r) => r.id),
    ["talk_1", "talk_2"],
  );
  assert.deepEqual(
    (await t.chat("c1", 1)).map((r) => r.id),
    ["talk_2"],
  );
  assert.equal(await t.latestAskChat(), "c2");
});

test("the gate refuses a session line with no session", async () => {
  const t = repo();
  await assert.rejects(
    t.say({ ...line("talk_9", "user"), scope: "session" }),
    WriteRefused,
  );
});
