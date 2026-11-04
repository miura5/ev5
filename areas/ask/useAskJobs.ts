import { useEffect, useState } from "react";
import type { AskJob } from "./types.ts";
import { jobApi, readToken } from "../../commands/client.ts";

const TITLES: Record<string, string> = {
  "practice-set": "Practice set",
  "study-plan": "Study plan",
};

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

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

/** Unfinished jobs for the chat to point at (CONTRACT §job.no-chat-ask: chat links to Activity, never starts a job).
 * Uses the token already pasted in Activity; without one the list stays empty. */
export function useAskJobs(copy?: ReadCopyLike): AskJobRef[] {
  const [jobs, setJobs] = useState<AskJobRef[]>([]);
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let live = true;
    // Offline, the saved list still shows what is open (§data.offline); any other failure stays quiet.
    (jobApi.list(token, copy) as Promise<WireJob[]>)
      .then((list) => {
        if (live) setJobs(list.map(toAskJob));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [copy]);
  return jobs;
}
