// The write rules the protocol suite runs its reference adapter with: the kind's domain parser, the kind's own write
// rules, and no title on a kind without one (the rules the docs gate applied, kept here for the suite).
import {
  noteWriteProblem,
  parseGoal,
  parseNote,
  parseObjective,
  parseSession,
  parseSet,
  type Note,
} from "../../domain/index.ts";
import type { Json } from "./canonical.ts";
import type { WriteProblem } from "./protocol.ts";

const PARSERS: Readonly<Record<string, (raw: unknown) => unknown>> = {
  exams: parseGoal,
  notes: parseNote,
  objectives: parseObjective,
  sessions: parseSession,
  sets: parseSet,
};

/** The kinds whose documents carry a `title` a rename may change; every other kind refuses one. */
const TITLED: readonly string[] = ["exams", "notes", "sets"];

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function parseProblem(c: string, id: string, doc: unknown): string | null {
  const parse = Object.hasOwn(PARSERS, c) ? PARSERS[c] : undefined;
  if (!parse) return null;
  try {
    parse(doc);
    return null;
  } catch (e) {
    return `${c}/${id} does not parse: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function noteProblem(id: string, doc: Json, prev: unknown): string | null {
  const why = noteWriteProblem(doc, prev as Note | null);
  return why ? `notes/${id}: ${why}` : null;
}

/** The write rules of every write: the kind's parser, its write rules, and no title on a kind without one. */
export const gateProblem: WriteProblem = (c, id, doc: Json, prev) =>
  parseProblem(c, id, doc) ??
  (c === "notes" ? noteProblem(id, doc, prev) : null) ??
  (Object.hasOwn(PARSERS, c) && isObj(doc) && "title" in doc && !TITLED.includes(c)
    ? `${c}/${id} has no title to change`
    : null);
