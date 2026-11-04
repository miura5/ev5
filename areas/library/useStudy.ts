import { useCallback } from "react";
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
