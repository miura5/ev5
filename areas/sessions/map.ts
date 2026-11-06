import {
  centralDate,
  parseSession,
  plainDay,
  sessionState,
} from "../../domain/index.ts";

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

/** When the session began: its startedAt, else its first event, else when the document was written (never blank). */
function startOf(s: Parsed): string | undefined {
  if (Number.isFinite(Date.parse(s.startedAt ?? "")))
    return s.startedAt ?? undefined;
  const first = Object.entries(s.events ?? {})
    .map(([, e]) => e?.at ?? "")
    .filter((a) => Number.isFinite(Date.parse(a)))
    .sort()[0];
  return first || s.at;
}

const startMs = (s: Parsed): number => Date.parse(startOf(s) ?? "") || 0;

/** Picks the latest running session by start and maps it; none running (only ended ones, or none) gives undefined (the empty state). */
export function mapSessions(
  docs: readonly WireDoc[],
  now: number,
): SessionData | undefined {
  const all = docs.flatMap(tryParse);
  // Only a running session is shown: an ended one would draw a stopped clock under live Pause and End controls.
  const pool = all.filter((s) => (s.status ?? "active") === "active");
  const pick = pool.sort(
    (a, b) => startMs(b) - startMs(a) || b.id.localeCompare(a.id),
  )[0];
  if (!pick) return undefined;
  // The clock comes from the events (domain sessionState): breaks and pauses are taken out of the study time.
  // A document with no startedAt would read 0 s (the clock has no start); count from the first event or its write time.
  const st = sessionState({ ...pick, startedAt: startOf(pick) }, now);
  const ended = pick.status === "ended" || pick.status === "discarded";
  return {
    id: pick.id,
    v: pick.v,
    raw: pick.raw,
    noteId: pick.noteId || undefined,
    title: pick.topic ?? "Session",
    meta: pick.date ? plainDay(pick.date, centralDate(now)) : "",
    seconds:
      ended && st.activeMs === 0 && (pick.minutes ?? 0) > 0
        ? Math.round((pick.minutes ?? 0) * 60)
        : Math.floor(st.activeMs / 1000),
    paused: st.paused || st.onBreak,
    ended,
  };
}
