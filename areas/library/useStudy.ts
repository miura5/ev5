import { useCallback, useEffect } from "react";
import { call, readToken } from "../../commands/client.ts";

/** What the shell hands the screen (shell/services.ts), restated: areas never import the shell. */
export interface LibraryServices {
  /** The saved copy of reads (shell/readCopy.ts): Library shows it when there is no connection. */
  readCopy?: { read<T>(key: string, fetcher: () => Promise<T>): Promise<T> };
  /** Holds a new build's reload while a study run is open; returns the release. */
  holdReload?: () => () => void;
  outbox: {
    queueCommand?(
      name: string,
      id: string,
      input: Record<string, unknown>,
    ): Promise<unknown>;
    replay(): Promise<unknown>;
    /** What waits on this device; an entry with `refused` was turned down for good and is not sent again. */
    waiting?(): Promise<
      ReadonlyArray<{ key: string; id: string; refused?: string }>
    >;
  };
}

/** A new build never reloads the page while a study run is open: held on open, released on finish or leave. */
export function useReloadHold(active: boolean, services?: LibraryServices) {
  const hold = services?.holdReload;
  useEffect(() => {
    if (!active || !hold) return;
    return hold();
  }, [active, hold]);
}

const attemptId = () =>
  `att_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

/** Rating handler for a study run: queued as study.attempt (so it survives no connection), then replayed. */
function useWriter(setId: string, services?: LibraryServices) {
  return useCallback(
    (itemId: string, rating: "again" | "good", attempt: string) => {
      const cmd = services?.outbox.queueCommand;
      if (!services || !cmd) return Promise.resolve(false);
      // A rating posts as study.attempt under a client att_ id (a replay after a lost reply is a 409, never a second row).
      const att = attemptId();
      return cmd
        .call(services.outbox, "study.attempt", att, {
          id: `${setId}/${itemId}`,
          answer: attempt,
          rating,
          attempt: att,
        })
        .then(
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

/** "Just tell me": queued as study.just_tell_me; resolves true once it is on the outbox. */
export function useTellMe(setId: string, services?: LibraryServices) {
  return useCallback(
    (itemId: string) => {
      const q = services?.outbox.queueCommand;
      // The command writes the attempt for both kinds of set (the server routes by the set's kind); the att_ id is made
      // here so a replay after a lost reply is a 409, never a second row.
      if (!services || !q) return Promise.resolve(false);
      const att = attemptId();
      return q
        .call(services.outbox, "study.just_tell_me", att, {
          id: `${setId}/${itemId}`,
          attempt: att,
        })
        .then(
          () => (void services.outbox.replay(), true),
          () => false,
        );
    },
    [setId, services],
  );
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
        { id: `${setId}/${itemId}`, answer, attempt: attemptId() },
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
