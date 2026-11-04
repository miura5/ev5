import { parseSession, sessionState } from "../../domain/index.ts";

type SessionDoc = ReturnType<typeof parseSession> & { id: string };

/** One document as GET /api/v1/docs returns it (server/doc-routes.ts), restated: areas never import the server. */
export interface WireDoc {
  id: string;
  /** The version it was read at; a write is pinned to it. */
  v?: number;
  data: unknown;
}

/** What the session screen shows of the session it picked. */
export interface SessionData {
  id: string;
  v?: number;
  /** The document as stored, so a write sends back every field it was read with. */
  raw: Record<string, unknown>;
  /** The note it reads along with, when it names one. */
  noteId?: string;
  title: string;
  meta: string;
  /** Seconds of study time so far, breaks and pauses left out. */
  seconds: number;
  /** Paused or on a break (both stop the clock). */
  paused: boolean;
  ended: boolean;
}

type Parsed = SessionDoc & { v?: number; raw: Record<string, unknown> };

function tryParse(d: WireDoc): Parsed[] {
  try {
    return [
      {
        ...parseSession(d.data),
        id: d.id,
        v: d.v,
        raw: d.data as Record<string, unknown>,
      },
    ];
  } catch {
    return []; // a document outside the schema is left out, never an error
  }
}

const startMs = (s: Parsed): number => Date.parse(s.startedAt ?? "") || 0;

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
  // The clock comes from the events (domain sessionState): breaks and pauses are taken out of the study time.
  const st = sessionState(pick, now);
  const ended = pick.status === "ended" || pick.status === "discarded";
  return {
    id: pick.id,
    v: pick.v,
    raw: pick.raw,
    noteId: pick.noteId || undefined,
    title: pick.topic ?? "Study session",
    meta: pick.date,
    seconds: Math.floor(st.activeMs / 1000),
    paused: st.paused || st.onBreak,
    ended,
  };
}
