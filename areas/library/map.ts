import {
  centralDate,
  deriveWeakSpot,
  examDaysLeft,
  parseExam,
  parseSet,
  parseWeakSpot,
} from "../../domain/index.ts";
import type {
  LibraryExam,
  LibrarySet,
  Mastery,
  SetPageData,
  WeakSpot,
} from "./types.ts";

/** One document as GET /api/v1/docs returns it (server/doc-routes.ts), restated: areas never import the server. */
export interface WireDoc {
  id: string;
  data: unknown;
}

export interface LibraryDocs {
  exams: WireDoc[];
  weakspots: WireDoc[];
  sets: WireDoc[];
}

export interface LibraryData {
  weakSpots: WeakSpot[];
  exams: LibraryExam[];
  sets: LibrarySet[];
  /** Full pages by set id, for the set page when one is opened. */
  pages: Record<string, SetPageData>;
}

function tryParse<T>(
  parse: (raw: unknown) => T,
  d: WireDoc,
): { id: string; v: T }[] {
  try {
    return [{ id: d.id, v: parse(d.data) }];
  } catch {
    return []; // a document outside the schema is left out, never an error on Library
  }
}

const share = (n: number, of: number) => (of > 0 ? n / of : 0);

/** Maps the three collections Library reads to the views' props; no data gives empty lists. */
export function mapLibrary(docs: LibraryDocs, now: Date | number): LibraryData {
  const today = centralDate(now);
  const spots = docs.weakspots
    .flatMap((d) => tryParse(parseWeakSpot, d))
    .map((s) => ({ ...s, d: deriveWeakSpot(s.v, [], { id: s.id }) }));
  const weakSpots: WeakSpot[] = spots
    .filter((s) => s.d.status === "open")
    .sort(
      (a, b) => b.d.misses - a.d.misses || a.v.topic.localeCompare(b.v.topic),
    )
    .map(({ id, v, d }) => {
      const total = d.streak + d.misses;
      const mastery: Mastery = {
        right: share(d.streak, total),
        shaky: 0,
        wrong: total ? share(d.misses, total) : 1,
      };
      const due = d.nextDue
        ? d.nextDue <= today
          ? "due today"
          : `due ${d.nextDue}`
        : "";
      return {
        id,
        title: v.topic,
        meta: [v.course, `${d.misses} missed`].filter(Boolean).join(" · "),
        mastery,
        due,
      };
    });
  const exams: LibraryExam[] = docs.exams
    .flatMap((d) => tryParse(parseExam, d))
    .filter((e) => (e.v.status ?? "upcoming") === "upcoming")
    .sort(
      (a, b) =>
        (a.v.date ?? "9999").localeCompare(b.v.date ?? "9999") ||
        a.v.title.localeCompare(b.v.title),
    )
    .map(({ id, v }) => {
      const mine = spots.filter(
        (s) => s.v.exam === id && ["open", "reviewed"].includes(s.d.status),
      );
      const ready = mine.filter((s) => s.d.status === "reviewed").length;
      const shaky = mine.filter(
        (s) => s.d.status === "open" && s.d.streak > 0,
      ).length;
      const left = examDaysLeft(v, today);
      const when = v.date
        ? `${v.date}${left !== null && left >= 0 ? ` · in ${left}d` : ""}`
        : "no date";
      return {
        id,
        title: v.title,
        meta: [v.course, when].filter(Boolean).join(" · "),
        mastery: {
          right: share(ready, mine.length),
          shaky: share(shaky, mine.length),
          wrong: share(mine.length - ready - shaky, mine.length),
        },
        readiness: mine.length
          ? `${Math.round(share(ready, mine.length) * 100)}%`
          : "",
      };
    });
  const sets: LibrarySet[] = [];
  const pages: Record<string, SetPageData> = {};
  for (const { id, v } of docs.sets.flatMap((d) => tryParse(parseSet, d))) {
    const title = v.title ?? `${v.kind} set`;
    const n = v.items.length;
    const meta = `${n} ${n === 1 ? "question" : "questions"}`;
    sets.push({ id, title, kind: "questions", meta });
    pages[id] = {
      id,
      title,
      kind: "questions",
      meta,
      items: v.items.map((q) => ({
        id: q.id,
        front: q.stem,
        back:
          (q.correct ?? [])
            .map((i) => q.options?.[i])
            .filter(Boolean)
            .join("; ") || undefined,
      })),
    };
  }
  return { weakSpots, exams, sets, pages };
}
