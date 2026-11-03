// The docs repository with ev4's Worker check, then the collection's domain parser (see registry.ts). It reaches the
// frozen schemas (node:fs), so it is for Node: tests, scripts and CI. The Worker uses `docsRepo` directly.
import { docsRepo, type DocsOptions, type DocsRepo } from "./repo.ts";
import { parsingProblem, type ParserRegistry } from "./registry.ts";

export function checkedDocsRepo(
  db: Parameters<typeof docsRepo>[0],
  { parsers = {}, ...o }: DocsOptions & { parsers?: ParserRegistry },
): DocsRepo {
  return docsRepo(db, { problem: parsingProblem(parsers), ...o });
}
