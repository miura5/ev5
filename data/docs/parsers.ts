// The wired registry: each ev4 collection that has a domain entity, mapped to its domain parser (hand validators; no
// zod). A write to one of these collections is parsed after ev4's Worker check (see registry.ts). Collections not
// listed here (and the ones with no domain entity yet, such as courses, collections and pins) are checked by ev4's
// Worker check and the frozen schemas only.
import {
  parseExam,
  parseNote,
  parseObjective,
  parseSession,
  parseSet,
  parseWeakSpot,
} from "../../domain/index.ts";

export const DOMAIN_PARSERS: Readonly<
  Record<string, (raw: unknown) => unknown>
> = {
  exams: parseExam,
  notes: parseNote,
  objectives: parseObjective,
  sessions: parseSession,
  sets: parseSet,
  weakspots: parseWeakSpot,
};
