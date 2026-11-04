import { parseSession } from "../../domain/index.ts";

type SessionDoc = ReturnType<typeof parseSession> & { id: string };

/** One document as GET /api/v1/docs returns it (server/doc-routes.ts), restated: areas never import the server. */
export interface WireDoc {
  id: string;
  data: unknown;
}

/** What the session screen shows of the session it picked. */
export interface SessionData {
  title: string;
  meta: string;
  /** Seconds of study time so far, breaks and pauses left out. */
  seconds: number;
  paused: boolean;
  ended: boolean;
}

function tryParse(d: WireDoc): SessionDoc[] {
  try {
    return [{ ...parseSession(d.data), id: d.id }];
  } catch {
    return []; // a document outside the schema is left out, never an error
  }
}

const startMs = (s: SessionDoc): number => Date.parse(s.startedAt ?? "") || 0;

/** Picks the running session, else the latest one by start, and maps it; no sessions gives undefined (the empty state). */
export function mapSessions(
  docs: readonly WireDoc[],
  now: number,
): SessionData | undefined {
  const all = docs.flatMap(tryParse);
  const pool = all.filter((s) => (s.status ?? "active") === "active");
  const pick = (pool.length > 0 ? pool : all).sort(
    (a, b) => startMs(b) - startMs(a) || b.id.localeCompare(a.id),
  )[0];
  if (!pick) return undefined;
  // Elapsed wall time: the domain barrel does not export sessionState yet, so breaks and pauses are not taken out.
  const end = Date.parse(pick.endedAt ?? "") || now;
  const ended = pick.status === "ended" || pick.status === "discarded";
  return {
    title: pick.topic ?? "Study session",
    meta: pick.date,
    seconds: startMs(pick)
      ? Math.max(0, Math.floor((end - startMs(pick)) / 1000))
      : 0,
    paused: false,
    ended,
  };
}
