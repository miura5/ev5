import { useCallback, useEffect, useRef, useState } from "react";
import { mapLibrary } from "./map.ts";
import type { LibraryData, WireDoc, WireJob } from "./map.ts";
import {
  ApiError,
  api,
  call,
  jobApi,
  type CommandName,
  failureKind,
  failureSentence,
  readToken,
  savedFirst,
} from "../../commands/client.ts";

/** How often Library reads again, so a new or changed plan draft shows without a reload. */
export const PLAN_POLL_MS = 10_000;
/** While a plan is being saved, read again sooner so the new plan shows as soon as it lands. */
export const WORKING_POLL_MS = 2_000;

export interface LibraryState {
  data?: LibraryData;
  token: string;
  error?: string;
  /** The server refused the token: the shell asks for a new one. */
  refused?: boolean;
  /** Runs a prep-plan command, then reads the library again; resolves to a plain sentence when it fails. */
  runPlan(
    name: PlanCommand,
    input: Record<string, string>,
  ): Promise<string | undefined>;
  /** Sets a date's kind (date.update), then reads again; resolves to a plain sentence when it fails. */
  setKind(id: string, kind: string): Promise<string | undefined>;
  /** Answers a prep plan that is still waiting (approve or put away), then reads again. */
  answerPlan(
    jobId: string,
    decision: "approve" | "put_away",
  ): Promise<string | undefined>;
}

export type PlanCommand = Extract<
  CommandName,
  "date.plan_with_ev" | "plan.approve" | "plan.ask_changes" | "plan.put_away"
>;

/** The sentence for a plan command that did not go through; 501 is a handler the server does not have yet. */
export function planFailure(status: number, reason: string): string {
  return status === 501 ? "E.V. cannot do that yet. It is not ready." : reason;
}

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

/** Offline (a rejected fetch) the saved copy answers; a 401 or 5xx throws and is never kept as the copy (§data.offline). */
function list(
  collection: string,
  token: string,
  copy?: ReadCopyLike,
): Promise<WireDoc[]> {
  const fetcher = async (): Promise<WireDoc[]> => {
    const r = await api(`docs?collection=${collection}`, token);
    if (!r.ok) throw new ApiError(r.status);
    return ((await r.json()) as { docs: WireDoc[] }).docs;
  };
  return copy ? copy.read(`library:${collection}`, fetcher) : fetcher();
}

/** Reads exams, weak spots and sets with the app token Matt keeps in this browser (the shell holds none). */
export function useLibrary(copy?: ReadCopyLike): LibraryState {
  const [again, setAgain] = useState(0);
  const [token] = useState(readToken);
  const [data, setData] = useState<LibraryData>();
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const warm = useRef(true);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const load = (c: ReadCopyLike | undefined) =>
      Promise.all([
        list("exams", token, c),
        list("weakspots", token, c),
        list("sets", token, c),
        list("answers", token, c),
        // Which plan is in force is a nicety: when it cannot be read, every plan reads as a draft, so a miss is none.
        list("planedits", token, c).catch((): WireDoc[] => []),
        // The approved plan's sessions live in its document; unreadable, the Detail just lists none.
        list("plans", token, c).catch((): WireDoc[] => []),
        // A plan waiting for his answer is a job, not yet a document; when jobs cannot be read, none is waiting.
        jobApi.list(token, c).catch((): unknown[] => []),
      ]);
    const first = warm.current;
    warm.current = false;
    // The screen opens on the last answer kept, then the server's (§ui.instant).
    savedFirst(
      copy,
      first,
      load,
      (r) => {
        if (!live) return;
        const [exams, weakspots, sets, answers, planedits, plans, jobs] = r;
        setData(
          mapLibrary(
            {
              exams,
              weakspots,
              sets,
              answers,
              planedits,
              plans,
              jobs: jobs as WireJob[],
            },
            Date.now(),
          ),
        );
        setError(undefined);
      },
      () => setData(undefined),
    ).catch((e: unknown) => {
      // A refused token shows nothing here: the shell's token screen takes over.
      if (live && failureKind(e) === "refused") setRefused(true);
      if (live)
        setError(failureKind(e) === "refused" ? undefined : failureSentence(e));
    });
    return () => {
      live = false;
    };
  }, [token, copy, again]);
  const working = !!data?.exams.some((e) => e.planState === "working");
  // A prep plan job changes state on its own (drafted, revised): follow it without a reload.
  useEffect(() => {
    if (!token) return;
    const t = setInterval(
      () => {
        if (document.visibilityState !== "hidden") setAgain((n) => n + 1);
      },
      working ? WORKING_POLL_MS : PLAN_POLL_MS,
    );
    return () => clearInterval(t);
  }, [token, working]);
  const runPlan = useCallback(
    async (name: PlanCommand, input: Record<string, string>) => {
      const r = await call(name, input, token);
      if (!r.ok) return planFailure(r.status, r.reason);
      setAgain((n) => n + 1);
      return undefined;
    },
    [token],
  );
  const setKind = useCallback(
    async (id: string, kind: string) => {
      const r = await call("date.update", { id, kind }, token);
      if (!r.ok) return planFailure(r.status, r.reason);
      setAgain((n) => n + 1);
      return undefined;
    },
    [token],
  );
  const answerPlan = useCallback(
    async (jobId: string, decision: "approve" | "put_away") => {
      try {
        const r = await jobApi.answer(jobId, { decision }, token);
        if (!r.ok) return planFailure(r.status, failureSentence(r.status));
      } catch (e) {
        return failureSentence(e);
      }
      setAgain((n) => n + 1);
      // The sidebar count and Activity read the jobs again now, not at their next poll (restated: areas never import the shell).
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("ev5:jobs-changed"));
      return undefined;
    },
    [token],
  );
  return { data, token, error, refused, runPlan, setKind, answerPlan };
}
