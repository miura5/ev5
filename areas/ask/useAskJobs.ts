import { useEffect, useState } from "react";
import type { AskJob } from "./types.ts";
import { jobApi } from "../../commands/client.ts";

const KEY = "ev5.token";
const TITLES: Record<string, string> = { "practice-set": "Practice set", "study-plan": "Study plan" };

/** One entry of GET /api/v1/jobs (server/job-routes.ts); restated, areas never import the server. */
interface WireJob {
  id: string;
  kind: string;
  state: string;
  summary: string;
}

export interface AskJobRef {
  id: string;
  job: AskJob;
}

export const toAskJob = (j: WireJob): AskJobRef => ({
  id: j.id,
  job: {
    title: TITLES[j.kind] ?? j.kind,
    meta: j.summary,
    value: j.state === "needs-you" ? "needs you" : undefined,
    running: j.state === "running",
  },
});

const readToken = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

/** Unfinished jobs for the chat to point at (CONTRACT §job.no-chat-ask: chat links to Activity, never starts a job).
 * Uses the token already pasted in Activity; without one the list stays empty. */
export function useAskJobs(): AskJobRef[] {
  const [jobs, setJobs] = useState<AskJobRef[]>([]);
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let live = true;
    jobApi.list(token)
      .then(async (r) => {
        if (!r.ok) return;
        const b = (await r.json()) as { jobs: WireJob[] };
        if (live) setJobs(b.jobs.map(toAskJob));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return jobs;
}
