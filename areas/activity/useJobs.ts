import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityJob } from "./Activity.view.tsx";
import {
  api,
  failureKind,
  failureSentence,
  jobApi,
  readJson,
  readToken,
  savedFirst,
} from "../../commands/client.ts";

const TITLES: Record<string, string> = {
  "practice-set": "Practice set",
  "study-plan": "Study plan",
  "spend-alert": "Monthly spend",
  "study-session": "Study session",
};

/** Job kinds arrive as keys (study_plan); the row shows plain words. */
const titleOf = (kind: string): string =>
  TITLES[kind.replace(/_/g, "-")] ??
  kind.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The server's status text can carry a generic line, the specific reason, and a pointer to Activity.
 * A row shows one sentence: the pointer goes; a failure keeps its reason, anything else its first line. */
export function oneSentence(summary: string, state: string): string {
  const parts = (summary.match(/[^.!?]+[.!?]+/g) ?? [summary])
    .map((s) => s.trim())
    .filter(Boolean);
  const own = parts.filter((s) => s !== "It is waiting in Activity.");
  if (own.length < 2) return own[0] ?? summary;
  return state === "failed" ? own.slice(1).join(" ") : own[0]!;
}

/** The one sentence a row shows: the server's own fields when present, else the trimmed summary (old servers). */
const rowSentence = (j: {
  summary: string;
  state: string;
  lead?: string;
  reason?: string;
}): string =>
  j.state === "failed" && j.reason
    ? j.reason
    : (j.lead ?? oneSentence(j.summary, j.state));

/** One entry of GET /api/v1/jobs (server/job-routes.ts, jobs/runtime/status.ts); areas never import them, so restated. */
interface WireJob {
  id: string;
  kind: string;
  state: ActivityJob["state"];
  summary: string;
  /** Newer servers send the generic line and the reason apart (jobs/runtime/status.ts); older ones only `summary`. */
  lead?: string;
  reason?: string;
  /** A study plan's exam, in Matt's words, when the server names it (the exam's title). */
  examTitle?: string;
}

export const toActivityJob = (j: WireJob): ActivityJob => ({
  id: j.id,
  title:
    titleOf(j.kind) +
    (j.kind.replace(/_/g, "-") === "study-plan" && j.examTitle
      ? ` \u00b7 ${j.examTitle}`
      : ""),
  state: j.state,
  summary: j.lead ?? oneSentence(j.summary, j.state),
  // The reason a job needs Matt or failed is its own field; old servers only fold it into the summary.
  reason:
    j.state === "needs-you" || j.state === "failed"
      ? (j.reason ?? oneSentence(j.summary, j.state))
      : undefined,
  ...(j.kind === "spend-alert" && j.state === "needs-you"
    ? { dismissable: true }
    : {}),
});

/** Two records that read the same show once (the first stands for both). */
export const uniqueRows = (rows: ActivityJob[]): ActivityJob[] => {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.title}|${r.state}|${r.summary}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

export interface JobsState {
  jobs: ActivityJob[];
  /** True until the first answer (a list or a failure) arrives; "None." is only true after it. */
  loading: boolean;
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
  const [loading, setLoading] = useState(true);
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
      } else setTick((n) => n + 1);
    },
    [token],
  );
  const warm = useRef(true);
  useEffect(() => {
    if (!token) return;
    let live = true;
    // Offline, the saved list shows (§data.offline); the shell says it is a saved copy.
    // What finished today is a second read; if it fails the unfinished list still shows.
    const finished = (c: ReadCopyLike | undefined) =>
      readJson<WireJob[]>(
        "jobs?finished=today",
        token,
        "jobs-done",
        c,
        (b) => (b as { jobs: WireJob[] }).jobs,
      ).catch(() => [] as WireJob[]);
    const read = (c: ReadCopyLike | undefined) =>
      Promise.all([jobApi.list(token, c) as Promise<WireJob[]>, finished(c)]);
    // The first read opens on the last list kept, then the server's (§ui.instant); the 15 s re-reads go to the server.
    const load = (first = false) =>
      savedFirst(
        copy,
        first,
        read,
        ([open, done]) => {
          if (live) {
            const ids = new Set(open.map((j) => j.id));
            // Only unfinished rows are de-duplicated (repeat needs-you records); each finished job is its own row.
            setJobs([
              ...uniqueRows(open.map(toActivityJob)),
              ...done.filter((j) => !ids.has(j.id)).map(toActivityJob),
            ]);
            setLoading(false);
            setError(undefined);
            setRefused(false);
          }
        },
        () => setJobs([]),
      ).catch((e: unknown) => {
        if (!live) return;
        setLoading(false);
        const refusedNow = failureKind(e) === "refused";
        if (refusedNow) setJobs([]);
        setRefused(refusedNow);
        setError(failureSentence(e));
      });
    void load(warm.current);
    warm.current = false;
    // A re-read (the 15 s timer, a job change) goes to the server only.
    const reload = () => void load();
    const t = setInterval(reload, 15000);
    window.addEventListener("ev5:jobs-changed", reload);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener("ev5:jobs-changed", reload);
    };
  }, [token, tick, copy]);
  return { jobs, loading, token, refused, error, dismiss };
}
