// c -> parser: the domain parser a write to a collection must pass, on top of ev4's own Worker check. A collection
// not listed is checked by the frozen schemas in CI only (data/compat). data imports no domain folder here: the
// caller builds the registry, e.g. { exams: parseExam, weakspots: parseWeakSpot } (see DocsOptions.parsers), because
// depcruise's only-through-index allows `domain/index.ts` alone and that barrel does not exist yet.
import { ev4WorkerProblem } from "../compat/index.ts";
import type { Json, WriteProblem } from "../compat/index.ts";

export type Parser = (raw: unknown) => unknown;
export type ParserRegistry = Readonly<Record<string, Parser>>;

/** A write check that runs ev4's Worker check, then the collection's domain parser when it has one. */
export function parsingProblem(registry: ParserRegistry): WriteProblem {
  return (c: string, id: string, doc: Json, prev: Json | null) => {
    const worker = ev4WorkerProblem(c, id, doc, prev);
    if (worker) return worker;
    const parse = Object.hasOwn(registry, c) ? registry[c] : undefined;
    if (!parse) return null;
    try {
      parse(doc);
      return null;
    } catch (e) {
      return `${c}/${id} does not parse: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
}
