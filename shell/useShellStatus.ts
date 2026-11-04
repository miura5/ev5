import { useEffect, useState } from "react";
import { storedToken } from "./outbox/index.ts";

/** One entry of GET /api/v1/jobs (server/job-routes.ts), restated: the shell never imports jobs. */
interface WireJob {
  id: string;
  kind: string;
  state: string;
  summary: string;
}

export interface ShellStatus {
  counts: Record<string, number>;
  runningJob?: { id: string; text: string };
}

const TITLES: Record<string, string> = {
  "practice-set": "Practice set",
  "study-plan": "Study plan",
};

/** Sidebar numbers from the job list: Activity's needs-you count and the one running job. */
export function statusFromJobs(jobs: readonly WireJob[]): ShellStatus {
  const needs = jobs.filter((j) => j.state === "needs-you").length;
  const run = jobs.find((j) => j.state === "running");
  return {
    counts: needs > 0 ? { activity: needs } : {},
    runningJob: run
      ? { id: run.id, text: `${TITLES[run.kind] ?? run.kind} running` }
      : undefined,
  };
}

/** Polls the jobs with the stored token (read each time, so a token pasted later works); quiet on any failure. */
export function useShellStatus(
  every = 30_000,
  doFetch: typeof fetch = (u, i) => fetch(u, i),
): ShellStatus {
  const [status, setStatus] = useState<ShellStatus>({ counts: {} });
  useEffect(() => {
    let live = true;
    const load = async () => {
      const token = storedToken();
      if (!token) return;
      try {
        const r = await doFetch("/api/v1/jobs", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const b = (await r.json()) as { jobs?: WireJob[] };
        if (live) setStatus(statusFromJobs(b.jobs ?? []));
      } catch {
        // offline: keep what the sidebar last showed
      }
    };
    void load();
    const t = setInterval(() => void load(), every);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [every, doFetch]);
  return status;
}
