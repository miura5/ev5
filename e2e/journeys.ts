// Gate 5 journeys against a running /api/v1 (PLAN Phase 5 gate). Each journey is a function of an injected `get`/`send`
// pair, so the logic runs offline in journeys.test.ts and for real from gate5.spec.ts against staging.

export interface Reply {
  status: number;
  body: unknown;
}
export type Call = (
  method: string,
  path: string,
  body?: unknown,
) => Promise<Reply>;

export interface Journey {
  name: string;
  /** Why the app cannot do this yet; a todo journey is listed, never run, and never fails the gate. */
  todo?: string;
  run?: (call: Call, runId: string) => Promise<void>;
}

class Fail extends Error {}
const must = (ok: boolean, msg: string): void => {
  if (!ok) throw new Fail(msg);
};
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
const list = (v: unknown, key: string): Record<string, unknown>[] => {
  const a = obj(v)[key];
  return Array.isArray(a) ? a.map(obj) : [];
};
const ok = async (
  call: Call,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> => {
  const r = await call(method, path, body);
  must(
    r.status >= 200 && r.status < 300,
    `${method} ${path} answered ${r.status}`,
  );
  return r.body;
};
const docs = (call: Call, collection: string) =>
  ok(call, "GET", `/api/v1/docs?collection=${collection}`).then((b) =>
    list(b, "docs"),
  );

export const JOURNEYS: Journey[] = [
  {
    name: "Today: the staging record answers and the synthetic exam is there",
    run: async (call) => {
      const exams = await docs(call, "exams");
      must(
        exams.some((d) => d["id"] === "synthetic-exam"),
        "exams has no synthetic-exam (seed data/staging/seed.sql)",
      );
      const day = await call(
        "GET",
        "/api/v1/docs?collection=dayedits&id=2000-01-01",
      );
      must(
        day.status === 404,
        `a day with no edits should be 404, got ${day.status}`,
      );
    },
  },
  {
    name: "Library: exams and sets list, a known exam reads back whole",
    run: async (call) => {
      await docs(call, "sets");
      const one = obj(
        await ok(
          call,
          "GET",
          "/api/v1/docs?collection=exams&id=synthetic-exam",
        ),
      );
      must(
        one["id"] === "synthetic-exam" && typeof one["v"] === "number",
        "exam doc lacks id or version",
      );
      must(
        obj(one["data"])["course"] === "BIO 201",
        "exam data was not returned",
      );
    },
  },
  {
    name: "Sessions: the sessions collection lists",
    run: async (call) => {
      await docs(call, "sessions");
    },
  },
  {
    name: "Notes: seeded notes list; a document writes, updates, refuses a stale write, and cannot be deleted",
    run: async (call, runId) => {
      const notes = await docs(call, "notes");
      must(notes.length >= 2, "expected the two synthetic notes");
      const id = `e2e-${runId}`;
      const at = `/api/v1/docs?collection=ideas&id=${id}`;
      const made = obj(await ok(call, "PUT", at, { text: "e2e one" }));
      must(
        made["version"] === 1,
        `a create should be version 1, got ${String(made["version"])}`,
      );
      const next = obj(
        await ok(call, "PUT", `${at}&if_version=1`, { text: "e2e two" }),
      );
      must(next["version"] === 2, "an update should be version 2");
      const stale = await call("PUT", `${at}&if_version=1`, { text: "stale" });
      must(
        stale.status === 409,
        `a stale write should be 409, got ${stale.status}`,
      );
      const back = obj(await ok(call, "GET", at));
      must(
        obj(back["data"])["text"] === "e2e two",
        "the document did not read back as last written",
      );
      const del = await call("DELETE", "/api/v1/docs");
      must(
        del.status === 403,
        `delete should be refused with 403, got ${del.status}`,
      );
    },
  },
  {
    name: "Activity: the jobs list reads",
    run: async (call) => {
      const jobs = list(await ok(call, "GET", "/api/v1/jobs"), "jobs");
      for (const j of jobs)
        must(
          typeof obj(j)["state"] === "string" || "status" in j || "id" in j,
          "a job row has no shape",
        );
    },
  },
  {
    name: "Collections: collections, memberships and deletions read (empty is fine)",
    run: async (call) => {
      for (const k of ["collections", "memberships", "deletions"]) {
        const b = await ok(call, "GET", `/api/v1/${k}`);
        must(Array.isArray(obj(b)[k]), `/${k} did not answer a ${k} list`);
      }
    },
  },
  {
    name: "Plan today: add, edit, delete and restore a plan item",
    todo: "Today has no plan-item writes yet; dayedits doc shape is unverified (handover)",
  },
  {
    name: "Practice set: do a set",
    todo: "needs a browser and a saved set; the job itself runs in gate4-e2e.yml",
  },
  {
    name: "Question set by hand, then keep and drop E.V.'s drafts",
    todo: "hand-made set editing is not wired (Library leftovers)",
  },
  {
    name: "Collection: make, move a note in, pin, delete, restore",
    todo: "writes to collections and pins are not built (B-750 leftovers; no write routes)",
  },
  {
    name: "Study plan: make and approve",
    todo: "approval UI and change rounds need a browser plus a model run (cost); job covered by gate4-e2e.yml",
  },
  {
    name: "Notes: write offline, then sync",
    todo: "needs a browser with a service worker and the outbox; notes collections/new note not built (B-784)",
  },
  {
    name: "Study session: run one",
    todo: "Sessions writes go straight to the server and the sessions doc shape is unverified",
  },
  {
    name: 'Ask "is it ready?" while a job runs',
    todo: "Ask has no chat route (CONTRACT §job.no-chat-ask)",
  },
];

export interface Result {
  name: string;
  state: "pass" | "fail" | "todo";
  note?: string;
}

/** Runs every journey in order; one failing never stops the rest. */
export async function runAll(
  call: Call,
  runId: string,
  journeys: Journey[] = JOURNEYS,
): Promise<Result[]> {
  const out: Result[] = [];
  for (const j of journeys) {
    if (j.todo !== undefined || !j.run) {
      out.push({ name: j.name, state: "todo", note: j.todo ?? "no run" });
      continue;
    }
    try {
      await j.run(call, runId);
      out.push({ name: j.name, state: "pass" });
    } catch (e) {
      out.push({
        name: j.name,
        state: "fail",
        note: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}

/** An HTTP Call over fetch with the app token. */
export const httpCall =
  (base: string, token: string): Call =>
  async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep the text */
    }
    return { status: res.status, body: parsed };
  };
