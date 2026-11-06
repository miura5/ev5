// The wired registry: each docs kind that has a domain entity, mapped to its domain parser. The gate (gate.ts) parses
// a write to one of these kinds, and every read of it. A kind not listed here has no domain entity yet and is not
// parsed.
import {
  parseGoal,
  parseNote,
  parseObjective,
  parseSession,
  parseSet,
} from "../../domain/index.ts";

export const DOMAIN_PARSERS: Readonly<
  Record<string, (raw: unknown) => unknown>
> = {
  exams: parseGoal,
  notes: parseNote,
  objectives: parseObjective,
  sessions: parseSession,
  sets: parseSet,
};
