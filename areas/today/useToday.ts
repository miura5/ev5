import { useCallback, useEffect, useState } from "react";
import { centralDate } from "../../domain/index.ts";
import { mapToday, spendAlertLine } from "./map.ts";
import { buildDayEdit } from "./dayedit.ts";
import type { DayEditDoc } from "./dayedit.ts";
import type { TodayData, WireDoc, WireJobLine } from "./map.ts";
import { api, jobApi } from "../../commands/client.ts";

const KEY = "ev5.token";

const readToken = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export interface TodayState {
  data?: TodayData;
  token: string;
  error?: string;
  /** The monthly spend alert line, when one is waiting. */
  alert?: string;
  /** Tick (or un-tick) a plan item; resolves false when it could not be saved. */
  tick: (id: string, done: boolean) => Promise<boolean>;
  setToken: (t: string) => void;
}

class Unauthorized extends Error {}

async function get(path: string, token: string): Promise<Response> {
  const r = await api(`docs?${path}`, token);
  if (r.status === 401) throw new Unauthorized();
  return r;
}

const list = async (collection: string, token: string): Promise<WireDoc[]> => {
  const r = await get(`collection=${collection}`, token);
  if (!r.ok) throw new Error(collection);
  return ((await r.json()) as { docs: WireDoc[] }).docs;
};

/** Reads exams, weak spots and today's plan edits with the app token Matt keeps in this browser (the shell holds none). */
export function useToday(): TodayState {
  const [token, setTokenState] = useState(readToken);
  const [data, setData] = useState<TodayData>();
  const [error, setError] = useState<string>();
  const [alert, setAlert] = useState<string>();
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
    const now = Date.now();
    void (async () => {
      try {
        const day = await get(
          `collection=dayedits&id=${centralDate(now)}`,
          token,
        );
        const [exams, weakspots] = await Promise.all([
          list("exams", token),
          list("weakspots", token),
        ]);
        try {
          const jr = await jobApi.list(token);
          const jobs = jr.ok
            ? ((await jr.json()) as { jobs: WireJobLine[] }).jobs
            : [];
          if (live) setAlert(spendAlertLine(jobs));
        } catch {
          // the alert is extra: Today still loads without it
        }
        const dayedit = day.ok ? ((await day.json()) as WireDoc) : undefined;
        if (live) {
          setData(mapToday({ exams, weakspots, dayedit }, now));
          setError(undefined);
        }
      } catch (e) {
        if (live)
          setError(
            e instanceof Unauthorized
              ? "That token was not accepted."
              : "Today could not load.",
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);
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
  return { data, token, error, alert, tick, setToken };
}
