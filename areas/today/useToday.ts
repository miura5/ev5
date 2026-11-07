import { useCallback, useEffect, useRef, useState } from "react";
import { centralDate } from "../../domain/index.ts";
import type { AttemptRow, SetItemRow } from "../../domain/index.ts";
import { mapToday, spendAlertLine, prepPlanWaiting } from "./map.ts";
import type { TodayData, WireDoc, WireJobLine } from "./map.ts";
import {
  ApiError,
  api,
  call,
  failureKind,
  failureSentence,
  jobApi,
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

/** The rows of one kind from GET /<path> (the domain row shape, §data.gate). */
const rowsOf = async <T,>(path: string, token: string): Promise<T[]> => {
  const r = await api(path, token);
  if (!r.ok) throw new ApiError(r.status);
  return ((await r.json()) as { rows: T[] }).rows;
};

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
  useEffect(() => {
    if (!token) return;
    let live = true;
    const now = Date.now();
    // Every read goes out at once; offline, each gives back its saved copy (§data.offline) and the shell says so.
    const load = async (c: ReadCopyLike | undefined) => {
      const saved = <T,>(key: string, get: () => Promise<T>) =>
        c ? c.read(key, get) : get();
      const today = centralDate(now);
      // Which plan is in force is a nicety: when it cannot be read, none is approved.
      const planRead = saved("today:plans", () => list("plans", token)).catch(
        (): WireDoc[] => [],
      );
      // The approved plan's sessions are its plan_items rows; unreadable, Today just lists none from it.
      const items = saved("today:plan_items", () =>
        list("plan_items", token),
      ).catch((): WireDoc[] => []);
      // Answers and the items they were aimed at give a spot its misses and streak; unreadable, a spot reads as unanswered.
      const attempts = saved("today:attempts", () =>
        rowsOf<AttemptRow>("attempts", token),
      ).catch((): AttemptRow[] => []);
      const setItems = saved("today:items", () =>
        rowsOf<SetItemRow>("items", token),
      ).catch((): SetItemRow[] => []);
      // The jobs are extra: Today still loads without them.
      const jobRead = jobApi.list(token, c).then(
        (j) => j as WireJobLine[],
        () => undefined,
      );
      const [exams, weakspots, plans, planItems, jobs, answers, setRows] = await Promise.all([
        saved("today:exams", () => list("exams", token)),
        saved("today:weakspots", () => list("weakspots", token)),
        planRead,
        items,
        jobRead,
        attempts,
        setItems,
      ]);
      return { exams, weakspots, plans, planItems, jobs, answers, setRows };
    };
    const first = warm.current;
    warm.current = false;
    // The screen opens on the last answer kept, then the server's (§ui.instant).
    savedFirst(copy, first, load, (r) => {
      if (!live) return;
      if (r.jobs) {
        setAlert(spendAlertLine(r.jobs));
        setPlanWaiting(prepPlanWaiting(r.jobs));
      }
      const { exams, weakspots, plans, planItems, answers, setRows } = r;
      setData(
        mapToday(
          {
            exams,
            weakspots,
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
    }, () => setData(undefined)).catch((e: unknown) => {
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
    (id: string, kind: string) => add("date.update", { id, kind }),
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
        d ? { ...d, plan: d.plan.map((p) => (p.id === id ? { ...p, done } : p)) } : d,
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
