import { useEffect, useState } from "react";
import { centralDate, daysBetween, plainDay } from "../domain/index.ts";
import { readJson, readToken } from "../commands/client.ts";
import type { ReadCopy } from "./readCopy.ts";
import type { GlyphType } from "../kit/index.ts";

/** One sidebar pin: what the row shows, and where it opens. */
export interface SidebarPin {
  id: string;
  title: string;
  type: GlyphType;
  /** The day of the collection's next linked date ("Thu", "Nov 9"); absent when it has none. */
  when?: string;
  to?: string;
}

/** What a pin needs of a row: its id and the words it shows. */
export interface PinRowTitle {
  id: string;
  title: string;
}

/** The pins, the collections, and the goal rows (dates) read from the row routes. */
export interface PinWire {
  pins: { collection: string; id: string }[];
  collections: { id: string; title: string; parentId: string | null }[];
  goals: {
    id: string;
    title: string;
    collection_id: string | null;
    date: string | null;
    status: string;
  }[];
  /** Titles by the pin's kind ("notes", "sets", "weakspots"); goals come from `goals`. */
  titles: Record<string, PinRowTitle[]>;
}

/** The row route that holds each pinned kind; a pin names the document id, the row id may carry a prefix. */
const ROUTES: Record<string, { path: string; prefix: string }> = {
  notes: { path: "notes", prefix: "note_" },
  sets: { path: "sets", prefix: "set_" },
  weakspots: { path: "weak-spots", prefix: "ws_" },
};
const GOAL_KINDS = new Set(["exams", "goals"]);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPES: Record<string, GlyphType> = {
  notes: "note",
  collections: "collection",
  sets: "questions",
  exams: "date",
  goals: "date",
};

/** "Thu" inside the next week, else "Nov 9" (the same words Today uses for a date). */
function whenLabel(date: string, left: number, today: string): string {
  return left < 7
    ? (DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? "")
    : plainDay(date, today);
}

const titled = (
  rows: PinRowTitle[] | undefined,
  id: string,
  prefix: string,
) => {
  const row = rows?.find((r) => r.id === id || r.id === `${prefix}${id}`);
  return row?.title.trim() || "Untitled";
};

const openAt = (c: string, id: string): string | undefined => {
  const q = encodeURIComponent(id);
  if (c === "collections") return `/collection/${q}`;
  if (c === "notes") return `/notes?open=${q}`;
  if (c === "sets" || c === "exams" || c === "weakspots")
    return `/library?open=${q}`;
  return undefined;
};

/** The pinned items for the sidebar. A pinned collection shows the day of the next date linked to it
 * (directly, or through a collection inside it); a date already past is not "next". */
export function sidebarPins(w: PinWire, now: Date | number): SidebarPin[] {
  const today = centralDate(now);
  const parent = new Map(w.collections.map((c) => [c.id, c.parentId]));
  const next = new Map<string, { date: string; left: number }>();
  for (const g of w.goals) {
    if (!g.date || g.status === "done") continue;
    const left = daysBetween(today, g.date);
    if (left < 0) continue;
    // The collection it is in, and the one that holds that (one level, as the mock-up does).
    for (const cid of [
      g.collection_id,
      g.collection_id && parent.get(g.collection_id),
    ]) {
      if (!cid) continue;
      const had = next.get(cid);
      if (!had || left < had.left) next.set(cid, { date: g.date, left });
    }
  }
  return w.pins.flatMap((p) => {
    const coll = w.collections.find((c) => c.id === p.id);
    if (p.collection === "collections" && !coll) return [];
    const n = next.get(p.id);
    return [
      {
        id: p.id,
        title:
          p.collection === "collections"
            ? (coll?.title ?? "Untitled")
            : GOAL_KINDS.has(p.collection)
              ? titled(w.goals, p.id, "goal_")
              : titled(
                  w.titles[p.collection],
                  p.id,
                  ROUTES[p.collection]?.prefix ?? "",
                ),
        type: TYPES[p.collection] ?? "note",
        ...(p.collection === "collections" && n
          ? { when: whenLabel(n.date, n.left, today) }
          : {}),
        to: openAt(p.collection, p.id),
      },
    ];
  });
}

/** Reads the pins, collections and linked dates with the stored token; quiet on any failure. */
export function usePins(copy?: ReadCopy): SidebarPin[] {
  const [pins, setPins] = useState<SidebarPin[]>([]);
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let live = true;
    function get<T>(path: string, pick: (b: unknown) => T) {
      return readJson<T>(path, token, `shell:/api/v1/${path}`, copy, pick);
    }
    const load = async () => {
      try {
        function rows<R>(path: string): Promise<R[]> {
          return get(path, (b) => (b as { rows?: R[] }).rows ?? []);
        }
        const [pins, collections, goals] = await Promise.all([
          get("pins", (b) => (b as { pins?: PinWire["pins"] }).pins ?? []),
          get(
            "collections",
            (b) =>
              (b as { collections?: PinWire["collections"] }).collections ?? [],
          ),
          // The dates: a pinned collection shows its next one. Unreadable, no day shows.
          rows<PinWire["goals"][number]>("goals").catch(
            (): PinWire["goals"] => [],
          ),
        ]);
        const titles: PinWire["titles"] = {};
        await Promise.all(
          [...new Set(pins.map((p) => p.collection))].map(async (k) => {
            const route = ROUTES[k];
            if (!route) return;
            try {
              const rs = await rows<Record<string, unknown>>(route.path);
              titles[k] = rs.map((r) => ({
                id: String(r.id),
                title: String(r.title ?? r.topic ?? ""),
              }));
            } catch {
              // a kind that will not load names its pins "Untitled"
            }
          }),
        );
        if (live)
          setPins(
            sidebarPins({ pins, collections, goals, titles }, Date.now()),
          );
      } catch {
        // offline or refused: keep what the sidebar last showed
      }
    };
    void load();
    const again = () => void load();
    window.addEventListener("ev5:jobs-changed", again);
    return () => {
      live = false;
      window.removeEventListener("ev5:jobs-changed", again);
    };
  }, [copy]);
  return pins;
}
