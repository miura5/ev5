import { centralDate, plainDay, type Note } from "../../domain/index.ts";
import type { NotePageData, NoteSummary } from "./types.ts";
import type { SaveState } from "./useNotes.ts";

const words = (n: Note) =>
  n.blocks
    .map((b) => b.runs.map((r) => r.text).join(""))
    .find(
      (t, i) =>
        t.trim() && n.blocks[i]?.type !== "h1" && n.blocks[i]?.type !== "img",
    ) ?? "";

const day = (iso: string, today: string) =>
  plainDay(centralDate(Date.parse(iso)), today);

export function toSummary(id: string, n: Note, today: string): NoteSummary {
  return {
    id,
    title: n.title || "Untitled",
    preview: words(n),
    when: day(n.editedAt ?? n.at, today),
    collectionId: null,
  };
}

export function toPage(
  id: string,
  n: Note,
  saveState: SaveState,
  today: string,
): NotePageData {
  return {
    id,
    title: n.title || "Untitled",
    collectionName: n.course ?? null,
    edited: day(n.editedAt ?? n.at, today),
    saveState,
    body: n.blocks,
  };
}
