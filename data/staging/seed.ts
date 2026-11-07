// Fills ev5-staging with a few synthetic rows (§sec.staging-data: no course codes, no names) through the gate: every
// row is written by a command on the deployed Worker, the same path the app uses (§data.gate), never by SQL.
// .github/workflows/staging.yml runs it after the deploy, with the app token in SEED_TOKEN (a GitHub secret, never a
// file or the log, §hard.no-secrets-in-files). It writes only when the record is empty, so the deploy on every merge
// never adds a second copy.

/** The seeded titles; the Gate 5 journeys look the dates up by these. */
export const SEED = {
  collection: "Synthetic collection",
  notes: ["Synthetic note one", "Synthetic note two"],
  exam: "Synthetic exam",
  other: "Synthetic other date",
  set: "Synthetic set",
} as const;

type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; text(): Promise<string> }>;

interface Seeder {
  url: string;
  token: string;
  fetch: Fetch;
  /** Now, in ms: the dates are counted from it. */
  now: number;
  log?: (line: string) => void;
}

const day = (now: number, days: number) =>
  new Date(now + days * 86_400_000).toISOString().slice(0, 10);

async function call(s: Seeder, method: string, path: string, body?: unknown) {
  const res = await s.fetch(`${s.url}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${s.token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (res.status !== 200)
    throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

/** Rows of one kind over its row route (GET /api/v1/notes, /goals), not the old /docs read. */
const rows = async (s: Seeder, path: "notes" | "goals") =>
  ((await call(s, "GET", `/api/v1/${path}`))["rows"] ?? []) as {
    id: string;
    title?: unknown;
    kind?: unknown;
  }[];

/** Runs one command and returns its result. */
async function cmd(s: Seeder, name: string, input: unknown) {
  const r = await call(s, "POST", `/api/v1/commands/${name}`, { input });
  s.log?.(`${name}: ok`);
  return r["result"] as Record<string, unknown>;
}

/** Empty means no notes and no seeded exam: anything else is a record someone (or an earlier seed) wrote. */
export async function isEmpty(s: Seeder): Promise<boolean> {
  if ((await rows(s, "notes")).length) return false;
  return !(await rows(s, "goals")).some((g) => g.title === SEED.exam);
}

async function note(s: Seeder, title: string, body: string, collection?: string) {
  const { id } = (await cmd(
    s,
    "note.create",
    collection ? { collection } : {},
  )) as { id: string };
  await cmd(s, "note.save", { id, body });
  await cmd(s, "item.rename", { id, title });
}

/** Seeds the record when it is empty; returns whether it wrote anything. Any refusal throws. */
export async function seed(s: Seeder): Promise<boolean> {
  if (!(await isEmpty(s))) {
    s.log?.("the staging record is not empty: nothing seeded");
    return false;
  }
  const { collection } = (await cmd(s, "collection.create", {
    title: SEED.collection,
  })) as { collection: { id: string } };
  await note(s, SEED.notes[0], "A synthetic paragraph.\nA second synthetic line.", collection.id);
  await note(s, SEED.notes[1], "Another synthetic paragraph.");
  await cmd(s, "date.create", { title: SEED.exam, date: day(s.now, 21), kind: "exam" });
  await cmd(s, "date.create", { title: SEED.other, date: day(s.now, 10), kind: "other" });
  const { set } = (await cmd(s, "set.create", {
    title: SEED.set,
    collection: collection.id,
  })) as { set: { id: string } };
  for (const text of [
    "Which synthetic option is right?\n* The first option\n- The second option",
    "Which synthetic options are right?\n* Option one\n* Option two\n- Option three",
  ])
    await cmd(s, "set.item_add", { set: set.id, text });
  return true;
}

// The project types no Node globals, so the entry check reads argv and the file name through narrow local types.
const argv1 = (globalThis as unknown as { process?: { argv?: string[] } }).process?.argv?.[1];
if (argv1 === (import.meta as { filename?: string }).filename) {
  const url = process.env["SEED_URL"];
  const token = process.env["SEED_TOKEN"];
  if (!url || !token) throw new Error("SEED_URL and SEED_TOKEN are required");
  const wrote = await seed({ url, token, fetch, now: Date.now(), log: console.log });
  console.log(wrote ? "seeded the synthetic record" : "left the record as it is");
}
