import { useCallback } from "react";
import { call, readToken } from "../../commands/client.ts";
import { buildAnswer } from "./answer.ts";

/** What the shell hands the screen (shell/services.ts), restated: areas never import the shell. */
export interface LibraryServices {
  /** The saved copy of reads (shell/readCopy.ts): Library shows it when there is no connection. */
  readCopy?: { read<T>(key: string, fetcher: () => Promise<T>): Promise<T> };
  outbox: {
    queueAnswer?(
      c: string,
      id: string,
      doc: Record<string, unknown>,
    ): Promise<unknown>;
    replay(): Promise<unknown>;
  };
}

const rand = () => Math.random().toString(36).slice(2, 6).padEnd(4, "0");

/** Rating handler for a study run: the answer is queued first (so it survives no connection), then replayed. */
function useWriter(setId: string, services?: LibraryServices) {
  return useCallback(
    (itemId: string, rating: "again" | "good" | "told", attempt: string) => {
      const q = services?.outbox.queueAnswer;
      if (!services || !q) return Promise.resolve(false);
      const a = buildAnswer(setId, itemId, rating, attempt, new Date(), rand());
      return q.call(services.outbox, "answers", a.id, a.doc).then(
        () => (void services.outbox.replay(), true),
        () => false,
      );
    },
    [setId, services],
  );
}

export function useStudy(setId: string, services?: LibraryServices) {
  const write = useWriter(setId, services);
  return useCallback(
    (itemId: string, rating: "again" | "good", attempt: string) =>
      void write(itemId, rating, attempt),
    [write],
  );
}

/** "Just tell me": queued as its own append-only answer (outcome "told"); resolves true once it is on the outbox. */
export function useTellMe(setId: string, services?: LibraryServices) {
  const write = useWriter(setId, services);
  return useCallback((itemId: string) => write(itemId, "told", ""), [write]);
}

/** What grading a typed open answer came to: the model's score and one line, or the sentence for why it did not. */
export type GradeOutcome =
  | { ok: true; score: number; correct: boolean; note?: string }
  | { ok: false; message: string };

/** The plain sentence for a refused grading call; open answers need the server, so there is no offline path. */
export function gradeFailure(status: number): string {
  if (status === 0)
    return "Open answers need you to be online. Try again when you are back online.";
  if (status === 400)
    return "That answer is too long to grade (over 4000 characters). Shorten it to the key points.";
  if (status === 429)
    return "E.V. has reached its grading limit for now. Try again later.";
  if (status === 502)
    return "E.V. could not grade that one. Try again in a moment.";
  if (status === 503)
    return "Grading is not available right now. Open answers need to be online.";
  return "Something went wrong on E.V.'s side. Try again in a moment.";
}

/** Grades a typed open answer through `study.attempt`: nothing is cut here, and the server keeps the score. */
export function useGrade(setId: string) {
  return useCallback(
    async (itemId: string, answer: string): Promise<GradeOutcome> => {
      const r = await call(
        "study.attempt",
        { id: `${setId}/${itemId}`, answer },
        readToken(),
      );
      if (!r.ok) return { ok: false, message: gradeFailure(r.status) };
      const b = (r.result ?? {}) as {
        score?: unknown;
        correct?: unknown;
        note?: unknown;
      };
      if (typeof b.score !== "number" || typeof b.correct !== "boolean")
        return { ok: false, message: gradeFailure(502) };
      return {
        ok: true,
        score: b.score,
        correct: b.correct,
        ...(typeof b.note === "string" && b.note ? { note: b.note } : {}),
      };
    },
    [setId],
  );
}
