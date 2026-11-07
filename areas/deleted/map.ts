import { centralDate, daysBetween, plainDay } from "../../domain/index.ts";
import type { DeletedItem } from "./Deleted.view.tsx";

/** One row of GET /api/v1/deletions (server/collection-routes.ts), restated: areas never import the server. */
export interface WireDeletion {
  collection: string;
  id: string;
  at: number;
  /** The kept item's title; null when the server could not find it. */
  title?: string | null;
}

const KEPT_DAYS = 30;
const TYPES: Record<string, DeletedItem["type"]> = {
  notes: "note",
  cards: "cards",
  questions: "questions",
  steps: "steps",
  plans: "plan",
  jobs: "job",
  goals: "date",
  // Deletions still key a goal as `exams` (data/tables/drafts.ts markGoal); both name the same thing.
  exams: "date",
  sessions: "steps",
  sets: "questions",
  set_items: "questions",
  collections: "collection",
};
/** Plain words for what was deleted; never a table name. */
const KINDS: Record<string, string> = {
  notes: "Note",
  cards: "Flashcard",
  questions: "Question",
  steps: "Step",
  plans: "Prep plan",
  jobs: "Job",
  goals: "Date",
  exams: "Date",
  sessions: "Session",
  set_items: "Set question",
  sets: "Set",
  collections: "Collection",
};

/** Newest first; days left out of the 30 kept by Central calendar date (same day deleted, same days left), never below zero. A row without a title reads Untitled, never its id. */
export function mapDeletions(
  rows: readonly WireDeletion[],
  now: number,
): DeletedItem[] {
  return [...rows]
    .sort((a, b) => b.at - a.at)
    .map((r) => {
      const deleted = centralDate(r.at);
      return {
        id: `${r.collection}/${r.id}`,
        type: TYPES[r.collection] ?? "note",
        title: r.title?.trim() || "Untitled",
        kind: KINDS[r.collection] ?? "Item",
        deletedOn: plainDay(deleted, centralDate(now)),
        daysLeft: Math.max(
          0,
          KEPT_DAYS - daysBetween(deleted, centralDate(now)),
        ),
      };
    });
}
