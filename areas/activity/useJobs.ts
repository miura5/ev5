import { useCallback, useEffect, useState } from "react";
import type { ActivityJob } from "./Activity.view.tsx";
import { api, failureKind, failureSentence, jobApi, readToken } from "../../commands/client.ts";

const TITLES: Record<string, string> = {
  "practice-set": "Practice set",
  "study-plan": "Study plan",
  "spend-alert": "Monthly spend",
};

/** One entry of GET /api/v1/jobs (server/job-routes.ts, jobs/runtime/status.ts); areas never import them, so restated. */
interface WireJob {
  id: string;
  kind: string;
  state: ActivityJob["state"];
  summary: string;
}

export const toActivityJob = (j: WireJob): ActivityJob => ({
  id: j.id,
  title: TITLES[j.kind] ?? j.kind,
  state: j.state,
  summary: j.summary,
  // The server's summary already carries the reason a job needs Matt or failed.
  reason:
    j.state === "needs-you" || j.state === "failed" ? j.summary : undefined,
  ...(j.kind === "spend-alert" && j.state === "needs-you"
    ? { dismissable: true }
    : {}),
});

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

export interface JobsState {
  jobs: ActivityJob[];
  token: string;
  /** The server refused the token (401): no data and no empty state; the shell's token screen takes over. */
  refused: boolean;
  /** A plain sentence for any other failure. */
  error?: string;
  /** Acknowledges an alert; the list then reloads without it. */
  dismiss: (id: string) => Promise<void>;
}

/** Reads the unfinished jobs with the app token Matt keeps in this browser (the public shell holds none, PLAN §10). */
export function useJobs(copy?: ReadCopyLike): JobsState {
  const token = readToken();
  const [jobs, setJobs] = useState<ActivityJob[]>([]);
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const [tick, setTick] = useState(0);
  const dismiss = useCallback(
    async (id: string) => {
      const r = await api(`jobs/${encodeURIComponent(id)}/dismiss`, token, {
        method: "POST",
      });
      if (!r.ok) {
        setRefused(failureKind(r.status) === "refused");
        setError(failureSentence(r.status));
      }
      else setTick((n) => n + 1);
    },
    [token],
  );
  useEffect(() => {
    if (!token) return;
    let live = true;
    // Offline, the saved list shows (§data.offline); the shell says it is a saved copy.
    const load = () =>
      (jobApi.list(token, copy) as Promise<WireJob[]>)
        .then((list) => {
          if (live) {
            setJobs(list.map(toActivityJob));
            setError(undefined);
            setRefused(false);
          }
        })
        .catch((e: unknown) => {
          if (!live) return;
          const refusedNow = failureKind(e) === "refused";
          if (refusedNow) setJobs([]);
          setRefused(refusedNow);
          setError(failureSentence(e));
        });
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [token, tick, copy]);
  return { jobs, token, refused, error, dismiss };
}
