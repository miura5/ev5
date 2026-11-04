import { useCallback } from "react";
import { buildAnswer } from "./answer.ts";

/** What the shell hands the screen (shell/services.ts), restated: areas never import the shell. */
export interface LibraryServices {
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
export function useStudy(setId: string, services?: LibraryServices) {
  return useCallback(
    (itemId: string, rating: "again" | "good", attempt: string) => {
      const q = services?.outbox.queueAnswer;
      if (!services || !q) return;
      const a = buildAnswer(setId, itemId, rating, attempt, new Date(), rand());
      void q.call(services.outbox, "answers", a.id, a.doc).then(
        () => services.outbox.replay(),
        () => undefined,
      );
    },
    [setId, services],
  );
}
