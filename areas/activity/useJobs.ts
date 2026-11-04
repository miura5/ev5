import { useCallback, useEffect, useState } from "react";
import type { ActivityJob } from "./Activity.view.tsx";
import { jobApi } from "../../commands/client.ts";

const KEY = "ev5.token";
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
});

const readToken = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export interface JobsState {
  jobs: ActivityJob[];
  token: string;
  error?: string;
  setToken: (t: string) => void;
}

/** Reads the unfinished jobs with the app token Matt keeps in this browser (the public shell holds none, PLAN §10). */
export function useJobs(): JobsState {
  const [token, setTokenState] = useState(readToken);
  const [jobs, setJobs] = useState<ActivityJob[]>([]);
  const [error, setError] = useState<string>();
  const setToken = useCallback((t: string) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // storage blocked: the token lasts this visit only
    }
    setTokenState(t);
  }, []);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const load = () =>
      jobApi
        .list(token)
        .then(async (r) => {
          if (!r.ok)
            throw new Error(
              r.status === 401
                ? "That token was not accepted."
                : "Activity could not load.",
            );
          const b = (await r.json()) as { jobs: WireJob[] };
          if (live) {
            setJobs(b.jobs.map(toActivityJob));
            setError(undefined);
          }
        })
        .catch((e: Error) => live && setError(e.message));
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [token]);
  return { jobs, token, error, setToken };
}
