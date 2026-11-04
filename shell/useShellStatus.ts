import { useEffect, useRef, useState } from "react";
import { storedToken } from "./outbox/index.ts";
import type { ReadCopy } from "./readCopy.ts";

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
  copy?: ReadCopy,
): ShellStatus {
  const [status, setStatus] = useState<ShellStatus>({ counts: {} });
  // The default fetch is a new function every render; keep the latest in a ref so the poll never restarts for it.
  const latest = useRef({ doFetch, copy });
  latest.current = { doFetch, copy };
  useEffect(() => {
    let live = true;
    const load = async () => {
      const token = storedToken();
      if (!token) return;
      try {
        const get = async () => {
          const r = await latest.current.doFetch("/api/v1/jobs", {
            headers: { authorization: `Bearer ${token}` },
          });
          if (!r.ok) throw new Error(`jobs ${r.status}`);
          return ((await r.json()) as { jobs?: WireJob[] }).jobs ?? [];
        };
        // Offline on a cold start, the saved list still gives the sidebar its numbers (§data.offline).
        const { copy } = latest.current;
        const jobs = copy ? await copy.read("jobs", get) : await get();
        if (live) setStatus(statusFromJobs(jobs));
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
  }, [every]);
  return status;
}
