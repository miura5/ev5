// The shared Worker, fake Workflows and seeded record for the job route tests.
import { fakeWorkflows } from "../jobs/index.ts";
import type { D1Like, ModelCall } from "../jobs/index.ts";
import app from "./index.ts";
import { runWorkflow } from "./job-run.ts";
import type { JobRunEnv } from "./job-run.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

export const T = new Date("2026-11-03T12:00:00Z");
const item = {
  stem: "Which action is first?",
  type: "single",
  options: ["a", "b", "c", "d"],
  correct: [1],
  rationales: ["w", "r", "w", "w"],
  sourceRef: "e1",
};
export const input = {
  variant: "practice",
  targetId: "set-1",
  count: 1,
  objectives: ["Vital signs"],
  excerpts: [{ id: "e1", text: "Pulse is measured..." }],
  drafts: false,
};

export const putNote = (db: D1Like, id: string, title: string, text: string) =>
  db
    .prepare(
      "INSERT INTO docs (c, id, data, at, v) VALUES ('notes', ?, ?, 0, 1)",
    )
    .bind(
      id,
      JSON.stringify({
        title,
        blocks: [{ id: "b1", type: "p", runs: [{ text }] }],
      }),
    )
    .run();

export function setup() {
  const db = sqliteD1();
  void db
    .prepare(
      "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
    )
    .run();
  void db
    .prepare(
      "INSERT INTO docs (c, id, data, at, v) VALUES ('notes', 'e1', ?, 0, 1)",
    )
    .bind(
      JSON.stringify({
        title: "Vital signs",
        blocks: [
          {
            id: "b1",
            type: "p",
            runs: [{ text: "Pulse is measured at the wrist." }],
          },
        ],
      }),
    )
    .run();
  for (const k of ["hourly", "daily", "monthly", "per_job"])
    db.prepare("INSERT INTO claude_settings (key, value, at) VALUES (?, ?, 0)")
      .bind(`ceiling_${k}`, 5_000_000)
      .run();
  const call: ModelCall = async () => ({
    stopReason: "end_turn",
    text: JSON.stringify({ items: [item] }),
    usage: { inputTokens: 2000, outputTokens: 1000 },
  });
  const run: JobRunEnv = {
    db,
    call,
    prompts: {
      practice_set: "write",
      study_plan: "plan",
      study_plan_changes: "chg",
    },
    planHome: { load: async () => undefined, apply: async () => "x" },
    now: () => T,
    newId: () => "h1",
  };
  const wf = fakeWorkflows((step, p) => runWorkflow(run, step, p));
  // The platform binding answers a repeated id by throwing, which cloudflareAdapter turns into 'exists'.
  const started: { input: { excerpts: { id: string; text: string }[] } }[] = [];
  const JOBS = {
    create: async (o: { id: string; params: unknown }) => {
      started.push(o.params as (typeof started)[number]);
      const r = await wf.adapter.create(
        o.id,
        o.params as Parameters<typeof wf.adapter.create>[1],
      );
      if (r === "exists") throw new Error("instance.already_exists");
    },
  };
  const env = {
    DB: db,
    JOBS,
    ASSETS: { fetch: async () => new Response("x") },
    TOKEN_APP: "fake-app",
    TOKEN_SCHEDULE: "fake-schedule",
    TOKEN_EXECUTOR: "fake-executor",
  };
  const req = (
    method: string,
    path: string,
    token: string | undefined,
    json?: unknown,
  ) =>
    app.request(
      path,
      {
        method,
        headers: {
          "cf-connecting-ip": "9.9.9.9",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(json === undefined ? {} : { body: JSON.stringify(json) }),
      },
      env,
    );
  return { req, wf, db, started };
}
