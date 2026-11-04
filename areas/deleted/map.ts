import { centralDate, plainDay } from "../../domain/index.ts";
import type { DeletedItem } from "./Deleted.view.tsx";

/** One row of GET /api/v1/deletions (server/collection-routes.ts), restated: areas never import the server. */
export interface WireDeletion {
  collection: string;
  id: string;
  at: number;
}

const DAY = 86_400_000;
const KEPT_DAYS = 30;
const TYPES: Record<string, DeletedItem["type"]> = {
  notes: "note",
  cards: "cards",
  questions: "questions",
  steps: "steps",
  plans: "plan",
  jobs: "job",
  goals: "date",
};

/** Newest first; days left out of the 30 kept, never below zero. The row carries no title, so the id stands in. */
export function mapDeletions(
  rows: readonly WireDeletion[],
  now: number,
): DeletedItem[] {
  return [...rows]
    .sort((a, b) => b.at - a.at)
    .map((r) => {
      return {
        id: `${r.collection}/${r.id}`,
        type: TYPES[r.collection] ?? "note",
        title: r.id,
        deletedOn: plainDay(centralDate(r.at), centralDate(now)),
        from: r.collection,
        daysLeft: Math.max(0, KEPT_DAYS - Math.floor((now - r.at) / DAY)),
      };
    });
}
