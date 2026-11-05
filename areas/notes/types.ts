import type { Note } from "../../domain/index.ts";

/** A note block: the one shape domain/note stores, with its type list, runs, indent, row and column (§ui.kit-leads). */
export type NoteBlock = Note["blocks"][number];

export interface NoteSummary {
  id: string;
  title: string;
  /** First line of the body. */
  preview: string;
  /** When it was last edited, e.g. "yesterday". */
  when: string;
  /** Id of its collection, or null for none. */
  collectionId: string | null;
}

export interface NoteCollection {
  id: string;
  title: string;
  /** Parent collection id; collections nest one level. */
  parentId: string | null;
}

export interface NotePageData {
  id: string;
  title: string;
  collectionName: string | null;
  edited: string;
  /** Shown beside the edited time. */
  saveState: "saved" | "saving" | "not saved";
  body: readonly NoteBlock[];
}

/** A study session on the note page. */
export interface NoteSessionState {
  /** Elapsed time, e.g. "18:20". */
  timer: string;
  paused: boolean;
  readAlong: boolean;
}
