import { useEffect, useState } from "react";
import {
  centralDate,
  goalDaysLeft,
  parseGoal,
  plainDay,
} from "../domain/index.ts";
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

interface WireDoc {
  id: string;
  data: unknown;
}
export interface PinWire {
  pins: { collection: string; id: string }[];
  collections: { id: string; title: string; parentId: string | null }[];
  memberships: { collection: string; id: string; collectionId: string }[];
  docs: Record<string, WireDoc[]>;
}

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

const title = (d: WireDoc | undefined): string => {
  const o = (d?.data ?? {}) as Record<string, unknown>;
  for (const k of ["title", "name", "text"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "Untitled";
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
  for (const m of w.memberships) {
    if (m.collection !== "exams") continue;
    const doc = w.docs.exams?.find((d) => d.id === m.id);
    if (!doc) continue;
    try {
      const exam = parseGoal(doc.data);
      const left = goalDaysLeft(exam, today);
      if (left === null || left < 0 || !exam.date || exam.status === "done")
        continue;
      // The collection it is in, and the one that holds that (one level, as the mock-up does).
      for (const cid of [m.collectionId, parent.get(m.collectionId)]) {
        if (!cid) continue;
        const had = next.get(cid);
        if (!had || left < had.left) next.set(cid, { date: exam.date, left });
      }
    } catch {
      // a date outside the schema is left out
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
            : title(w.docs[p.collection]?.find((d) => d.id === p.id)),
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
        const [pins, collections, memberships] = await Promise.all([
          get("pins", (b) => (b as { pins?: PinWire["pins"] }).pins ?? []),
          get(
            "collections",
            (b) =>
              (b as { collections?: PinWire["collections"] }).collections ?? [],
          ),
          get(
            "memberships",
            (b) =>
              (b as { memberships?: PinWire["memberships"] }).memberships ?? [],
          ),
        ]);
        const kinds = new Set(
          pins.map((p) => p.collection).filter((c) => c !== "collections"),
        );
        if (memberships.some((m) => m.collection === "exams"))
          kinds.add("exams");
        const docs: PinWire["docs"] = {};
        await Promise.all(
          [...kinds].map(async (k) => {
            try {
              docs[k] = await get(
                `docs?collection=${k}`,
                (b) => (b as { docs: WireDoc[] }).docs,
              );
            } catch {
              // a kind that will not load names its pins "Untitled"
            }
          }),
        );
        if (live)
          setPins(
            sidebarPins({ pins, collections, memberships, docs }, Date.now()),
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
