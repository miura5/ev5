import { useCallback, useEffect, useRef, useState } from "react";
import { centralDate } from "../../domain/index.ts";
import type {
  AttemptRow,
  GoalRow,
  LinkRow,
  SetItemRow,
  WeakSpotEventRow,
  WeakSpotTableRow,
} from "../../domain/index.ts";
import { mapToday, spendAlertLine, prepPlanWaiting } from "./map.ts";
import type { TodayData, WireJobLine } from "./map.ts";
import type { PlanItemRow, PlanRow } from "./plans.ts";
import {
  call,
  failureKind,
  failureSentence,
  jobApi,
  readJson,
  readToken,
  savedFirst,
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
  /** A prep plan waits for Matt in Activity. */
  planWaiting?: boolean;
  /** Tick (or un-tick) a plan item; resolves false when it could not be saved. */
  tick: (id: string, done: boolean) => Promise<boolean>;
  /** Add a plan item for today (plan.create); resolves false when it could not be saved. */
  addPlan: (title: string) => Promise<boolean>;
  /** Add a date (date.create); resolves false when it could not be saved. */
  addDate: (title: string, date: string) => Promise<boolean>;
  /** Ask E.V. to draft a prep plan for an exam (date.plan_with_ev); resolves false when it could not be sent. */
  planWithEv: (id: string) => Promise<boolean>;
  /** Set a date's kind (date.update); resolves false when it could not be saved. */
  setKind: (id: string, kind: string) => Promise<boolean>;
}

/** Reads exams, weak spots and today's plan items with the app token Matt keeps in this browser (the shell holds none). */
export function useToday(copy?: ReadCopyLike): TodayState {
  const [token] = useState(readToken);
  const [data, setData] = useState<TodayData>();
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const [alert, setAlert] = useState<string>();
  const [planWaiting, setPlanWaiting] = useState(false);
  const [again, setAgain] = useState(0);
  const warm = useRef(true);
  // The version each date was read at: date.update is pinned to it (§data.protocol).
  const goalV = useRef(new Map<string, number>());
  useEffect(() => {
    if (!token) return;
    let live = true;
    const now = Date.now();
    // Every read goes out at once; offline, each gives back its saved copy (§data.offline) and the shell says so.
    const load = async (c: ReadCopyLike | undefined) => {
      const today = centralDate(now);
      // Each kind is its own row read; offline it gives back its saved copy (§data.offline).
      function rows<T>(path: string): Promise<T[]> {
        return readJson(
          path,
          token,
          `rows:${path}`,
          c,
          (b) => (b as { rows: T[] }).rows,
        );
      }
      // Which plan is in force is a nicety: when it cannot be read, none is approved.
      const plans = rows<PlanRow>("plans").catch((): PlanRow[] => []);
      // The approved plan's sessions are its plan-items rows; unreadable, Today just lists none from it.
      const planItems = rows<PlanItemRow>("plan-items").catch(
        (): PlanItemRow[] => [],
      );
      // Events, links, answers and the items they were aimed at give a spot its misses, date and streak; unreadable, a spot reads as new and undated.
      const events = rows<WeakSpotEventRow>("weak-spot-events").catch(
        (): WeakSpotEventRow[] => [],
      );
      const links = rows<LinkRow>("links").catch((): LinkRow[] => []);
      const attempts = rows<AttemptRow>("attempts").catch(
        (): AttemptRow[] => [],
      );
      const setItems = rows<SetItemRow>("items").catch((): SetItemRow[] => []);
      // The jobs are extra: Today still loads without them.
      const jobRead = jobApi.list(token, c).then(
        (j) => j as WireJobLine[],
        () => undefined,
      );
      const [goals, weakspots, ...rest] = await Promise.all([
        rows<GoalRow>("goals"),
        rows<WeakSpotTableRow>("weak-spots"),
        plans,
        planItems,
        events,
        links,
        attempts,
        setItems,
        jobRead,
      ]);
      const [p, pi, weakSpotEvents, l, answers, setRows, jobs] = rest as [
        PlanRow[],
        PlanItemRow[],
        WeakSpotEventRow[],
        LinkRow[],
        AttemptRow[],
        SetItemRow[],
        WireJobLine[] | undefined,
      ];
      return {
        goals,
        weakspots,
        plans: p,
        planItems: pi,
        weakSpotEvents,
        links: l,
        jobs,
        answers,
        setRows,
      };
    };
    const first = warm.current;
    warm.current = false;
    // The screen opens on the last answer kept, then the server's (§ui.instant).
    savedFirst(
      copy,
      first,
      load,
      (r) => {
        if (!live) return;
        if (r.jobs) {
          setAlert(spendAlertLine(r.jobs));
          setPlanWaiting(prepPlanWaiting(r.jobs));
        }
        const { goals, weakspots, plans, planItems, answers, setRows } = r;
        goalV.current = new Map(goals.map((g) => [g.id, g.v]));
        setData(
          mapToday(
            {
              goals,
              weakspots,
              weakSpotEvents: r.weakSpotEvents,
              links: r.links,
              jobs: r.jobs ?? [],
              plans,
              planItems,
              attempts: answers,
              items: setRows,
            },
            now,
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
  // A prep plan job changes on its own (drafted, revised, approved): read again so Today follows without a reload.
  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "hidden") setAgain((n) => n + 1);
    }, 10_000);
    return () => clearInterval(t);
  }, [token]);
  // An add goes through the command (§cmd.registry), then Today reads itself again so the new line shows.
  const add = useCallback(
    async (
      name: "plan.create" | "date.create" | "date.update" | "date.plan_with_ev",
      input: unknown,
    ) => {
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
  const planWithEv = useCallback(
    (id: string) => add("date.plan_with_ev", { id }),
    [add],
  );
  const setKind = useCallback(
    (id: string, kind: string) => {
      const v = goalV.current.get(id);
      return v === undefined
        ? Promise.resolve(false)
        : add("date.update", { id, kind, if_version: v });
    },
    [add],
  );
  const tick = useCallback(
    async (id: string, done: boolean): Promise<boolean> => {
      // plan.toggle_done flips the item on the server, so it is sent only when the screen's state differs from `done`.
      const item = data?.plan.find((p) => p.id === id);
      if (!item) return false;
      if (item.done !== done) {
        const r = await call("plan.toggle_done", { id }, token);
        if (!r.ok || r.mode !== "direct") return false;
      }
      setData((d) =>
        d
          ? {
              ...d,
              plan: d.plan.map((p) => (p.id === id ? { ...p, done } : p)),
            }
          : d,
      );
      return true;
    },
    [token, data],
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
    planWithEv,
    setKind,
  };
}
