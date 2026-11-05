import { useCallback, useEffect, useState } from "react";
import { centralDate } from "../../domain/index.ts";
import { mapToday, spendAlertLine, studyPlanWaiting } from "./map.ts";
import { buildDayEdit } from "./dayedit.ts";
import type { DayEditDoc } from "./dayedit.ts";
import type { TodayData, WireDoc, WireJobLine } from "./map.ts";
import {
  ApiError,
  api,
  call,
  failureKind,
  failureSentence,
  jobApi,
  readToken,
} from "../../commands/client.ts";

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

export interface TodayState {
  data?: TodayData;
  token: string;
  error?: string;
  /** The server refused the token: the shell asks for a new one. */
  refused?: boolean;
  /** The monthly spend alert line, when one is waiting. */
  alert?: string;
  /** A study plan waits for Matt in Activity. */
  planWaiting?: boolean;
  /** Tick (or un-tick) a plan item; resolves false when it could not be saved. */
  tick: (id: string, done: boolean) => Promise<boolean>;
  /** Add a plan item for today (plan.create); resolves false when it could not be saved. */
  addPlan: (title: string) => Promise<boolean>;
  /** Add a date (date.create); resolves false when it could not be saved. */
  addDate: (title: string, date: string) => Promise<boolean>;
}

async function get(path: string, token: string): Promise<Response> {
  const r = await api(`docs?${path}`, token);
  if (r.status === 401) throw new ApiError(401);
  return r;
}

const list = async (collection: string, token: string): Promise<WireDoc[]> => {
  const r = await get(`collection=${collection}`, token);
  if (!r.ok) throw new ApiError(r.status);
  return ((await r.json()) as { docs: WireDoc[] }).docs;
};

/** The day's edit document, or null when there is none yet (a 404 or any non-ok answer). */
const dayEdit = async (day: string, token: string): Promise<WireDoc | null> => {
  const r = await get(`collection=dayedits&id=${day}`, token);
  return r.ok ? ((await r.json()) as WireDoc) : null;
};

/** Reads exams, weak spots and today's plan edits with the app token Matt keeps in this browser (the shell holds none). */
export function useToday(copy?: ReadCopyLike): TodayState {
  const [token] = useState(readToken);
  const [data, setData] = useState<TodayData>();
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const [alert, setAlert] = useState<string>();
  const [planWaiting, setPlanWaiting] = useState(false);
  const [again, setAgain] = useState(0);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const now = Date.now();
    void (async () => {
      try {
        // Offline, each read gives back its saved copy (§data.offline); the shell says so.
        const saved = <T,>(key: string, get: () => Promise<T>) =>
          copy ? copy.read(key, get) : get();
        const today = centralDate(now);
        const day = await saved(`today:dayedits:${today}`, () =>
          dayEdit(today, token),
        );
        const [exams, weakspots] = await Promise.all([
          saved("today:exams", () => list("exams", token)),
          saved("today:weakspots", () => list("weakspots", token)),
        ]);
        // Which plan is in force is a nicety: when it cannot be read, none is approved.
        const planedits = await saved("today:planedits", () =>
          list("planedits", token),
        ).catch((): WireDoc[] => []);
        let jobs: WireJobLine[] = [];
        try {
          jobs = (await jobApi.list(token, copy)) as WireJobLine[];
          if (live) {
            setAlert(spendAlertLine(jobs));
            setPlanWaiting(studyPlanWaiting(jobs));
          }
        } catch {
          // the alert is extra: Today still loads without it
        }
        const dayedit = day ?? undefined;
        if (live) {
          setData(
            mapToday({ exams, weakspots, dayedit, jobs, planedits }, now),
          );
          setError(undefined);
        }
      } catch (e) {
        // A refused token shows nothing here: the shell's token screen takes over.
        if (live && failureKind(e) === "refused") setRefused(true);
        if (live)
          setError(
            failureKind(e) === "refused" ? undefined : failureSentence(e),
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [token, copy, again]);
  // An add goes through the command (§cmd.registry), then Today reads itself again so the new line shows.
  const add = useCallback(
    async (name: "plan.create" | "date.create", input: unknown) => {
      const r = await call(name, input, token);
      if (!r.ok || r.mode !== "direct") return false;
      setAgain((n) => n + 1);
      return true;
    },
    [token],
  );
  const addPlan = useCallback(
    (title: string) => add("plan.create", { title }),
    [add],
  );
  const addDate = useCallback(
    (title: string, date: string) => add("date.create", { title, date }),
    [add],
  );
  const tick = useCallback(
    async (id: string, done: boolean): Promise<boolean> => {
      // online only (CONTRACT §data.offline): read the day as it is now, write it back whole, pinned to that version
      const day = centralDate(Date.now());
      const path = `collection=dayedits&id=${day}`;
      for (let tries = 0; tries < 2; tries++) {
        try {
          const r = await get(path, token);
          if (!r.ok && r.status !== 404) return false;
          const cur = r.ok
            ? ((await r.json()) as { v: number; data: Partial<DayEditDoc> })
            : undefined;
          const doc = buildDayEdit(cur?.data, day, id, done, new Date());
          const v = cur ? `&if_version=${cur.v}` : "";
          const w = await api(`docs?${path}${v}`, token, {
            method: "PUT",
            body: doc,
          });
          if (w.status === 409) continue; // the day moved on: read it again, once
          if (!w.ok) return false;
          setData((d) =>
            d
              ? {
                  ...d,
                  plan: d.plan.map((p) => (p.id === id ? { ...p, done } : p)),
                }
              : d,
          );
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    [token],
  );
  return {
    data,
    token,
    refused,
    error,
    alert,
    planWaiting,
    tick,
    addPlan,
    addDate,
  };
}
