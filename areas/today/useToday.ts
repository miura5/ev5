import { useCallback, useEffect, useState } from "react";
import { centralDate } from "../../domain/index.ts";
import { mapToday } from "./map.ts";
import type { TodayData, WireDoc } from "./map.ts";
import { api } from "../../commands/client.ts";

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
  return { data, token, error, setToken };
}
