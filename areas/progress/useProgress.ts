import type { AttemptRow } from "../../domain/index.ts";
import { useEffect, useRef, useState } from "react";
import { accuracyLine } from "../../domain/index.ts";
import { answersOf } from "./attempts.ts";
import { weeklyAccuracy, type Point } from "./series.ts";
import {
  failureKind,
  failureSentence,
  readJson,
  readToken,
  savedFirst,
  type ReadCopyLike,
} from "../../commands/client.ts";

export interface ProgressData {
  /** First-try accuracy over the last 14 days; null when there are no answers in the window. */
  accuracy: string | null;
  /** Any answer at all, so the empty-state sentence shows only for a user with none. */
  hasAnswers: boolean;
  /** First-try accuracy per week, 8 weeks, oldest first. */
  weeks: Point[];
}

export function mapProgress(
  attempts: readonly AttemptRow[],
  now: number,
): ProgressData {
  const answers = answersOf(attempts);
  return {
    accuracy: accuracyLine(answers, now)?.text ?? null,
    hasAnswers: answers.length > 0,
    weeks: weeklyAccuracy(answers, now),
  };
}

export interface ProgressState {
  data?: ProgressData;
  token: string;
  refused: boolean;
  error?: string;
}

/** Reads the attempts rows with the app token the user keeps in this browser (the shell holds none). */
export function useProgress(copy?: ReadCopyLike): ProgressState {
  const [token] = useState(readToken);
  const [data, setData] = useState<ProgressData>();
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const warm = useRef(true);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const load = (c: ReadCopyLike | undefined) =>
      readJson<AttemptRow[]>(
        "attempts",
        token,
        "progress:attempts",
        c,
        (b) => (b as { rows: AttemptRow[] }).rows,
      );
    const first = warm.current;
    warm.current = false;
    // The screen opens on the last answer kept, then the server's (§ui.instant).
    savedFirst(
      copy,
      first,
      load,
      (answers) => {
        if (!live) return;
        setData(mapProgress(answers, Date.now()));
        setError(undefined);
      },
      () => setData(undefined),
    ).catch((e: unknown) => {
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
