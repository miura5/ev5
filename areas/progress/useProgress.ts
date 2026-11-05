import { useEffect, useRef, useState } from "react";
import { accuracyLine } from "../../domain/index.ts";
import {
  dailyMinutes,
  windowTotals,
  weeklyAccuracy,
  type Point,
} from "./series.ts";
import {
  failureKind,
  failureSentence,
  readJson,
  readToken,
  savedFirst,
  type ReadCopyLike,
} from "../../commands/client.ts";

interface WireDoc {
  id: string;
  data: unknown;
}

export interface ProgressData {
  /** First-try accuracy over the last 14 days; null when there are no answers in the window. */
  accuracy: string | null;
  /** Any answer at all, so the empty-state sentence shows only for a student with none. */
  hasAnswers: boolean;
  /** Minutes studied in ended sessions. */
  minutes: number;
  /** Ended sessions that carry minutes. */
  sessions: number;
  /** First-try accuracy per week, 8 weeks, oldest first. */
  weeks: Point[];
  /** Minutes and ended sessions in the last 7 days. */
  week: { minutes: number; sessions: number };
  /** Study minutes per day, last 7 days. */
  days: Point[];
}

/** Ended-session minutes: sessions with status "ended" and a number of minutes (what End saves, §sessions). */
export function endedMinutes(docs: readonly WireDoc[]): {
  minutes: number;
  sessions: number;
} {
  let minutes = 0;
  let sessions = 0;
  for (const d of docs) {
    const s = d.data as { status?: unknown; minutes?: unknown } | null;
    if (s?.status !== "ended" || typeof s.minutes !== "number") continue;
    if (!(s.minutes > 0)) continue;
    minutes += s.minutes;
    sessions += 1;
  }
  return { minutes: Math.round(minutes), sessions };
}

export function mapProgress(
  answers: readonly WireDoc[],
  sessions: readonly WireDoc[],
  now: number,
): ProgressData {
  return {
    accuracy: accuracyLine(answers, now)?.text ?? null,
    hasAnswers: answers.length > 0,
    ...endedMinutes(sessions),
    weeks: weeklyAccuracy(answers, now),
    week: windowTotals(sessions, now),
    days: dailyMinutes(sessions, now),
  };
}

export interface ProgressState {
  data?: ProgressData;
  token: string;
  refused: boolean;
  error?: string;
}

/** Reads answers and sessions with the app token Matt keeps in this browser (the shell holds none). */
export function useProgress(copy?: ReadCopyLike): ProgressState {
  const [token] = useState(readToken);
  const [data, setData] = useState<ProgressData>();
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const warm = useRef(true);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const docs = (collection: string, c: ReadCopyLike | undefined) =>
      readJson<WireDoc[]>(
        `docs?collection=${collection}`,
        token,
        `progress:${collection}`,
        c,
        (b) => (b as { docs: WireDoc[] }).docs,
      );
    const load = (c: ReadCopyLike | undefined) =>
      Promise.all([docs("answers", c), docs("sessions", c)]);
    const first = warm.current;
    warm.current = false;
    // The screen opens on the last answer kept, then the server's (§ui.instant).
    savedFirst(copy, first, load, ([answers, sessions]) => {
      if (!live) return;
      setData(mapProgress(answers, sessions, Date.now()));
      setError(undefined);
    }, () => setData(undefined)).catch((e: unknown) => {
      if (!live) return;
      setRefused(failureKind(e) === "refused");
      setError(failureSentence(e));
    });
    return () => {
      live = false;
    };
  }, [token, copy]);
  return { data, token, refused, error };
}
