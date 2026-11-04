import { useEffect, useState } from "react";
import type { AskJob } from "./types.ts";
import { jobApi, readToken } from "../../commands/client.ts";

const TITLES: Record<string, string> = {
  "practice-set": "Practice set",
  "study-plan": "Study plan",
};

/** Job kinds arrive as keys (study_plan); the row shows plain words. */
const titleOf = (kind: string): string =>
  TITLES[kind.replace(/_/g, "-")] ?? kind.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The server's status text can carry a generic line, the specific reason, and a pointer to Activity.
 * A row shows one sentence: the pointer goes; a failure keeps its reason, anything else its first line. */
export function oneSentence(summary: string, state: string): string {
  const parts = (summary.match(/[^.!?]+[.!?]+/g) ?? [summary]).map((s) => s.trim()).filter(Boolean);
  const own = parts.filter((s) => s !== "It is waiting in Activity.");
  if (own.length < 2) return own[0] ?? summary;
  return state === "failed" ? own.slice(1).join(" ") : own[0]!;
}

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
    title: titleOf(j.kind),
    meta: oneSentence(j.summary, j.state),
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
