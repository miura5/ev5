/** One inline run of a block: text with its marks. */
export interface NoteRun {
  text: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
  href?: string;
}

/** A note block in ev4's flat shape; list items stay flat with an indent. */
export type NoteBlock =
  | { type: "h1" | "h2" | "h3" | "p"; runs: readonly NoteRun[] }
  | { type: "ul" | "ol"; indent?: number; runs: readonly NoteRun[] }
  | {
      type: "todo";
      indent?: number;
      checked?: boolean;
      runs: readonly NoteRun[];
    }
  | { type: "img"; alt?: string; width?: number };

/** A two-column row: a picture beside text blocks. */
export interface NoteRow {
  type: "row";
  id: string;
  left: readonly NoteBlock[];
  right: readonly NoteBlock[];
}

export type NoteBody = NoteBlock | NoteRow;

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
  body: readonly NoteBody[];
}

/** A study session on the note page. */
export interface NoteSessionState {
  /** Elapsed time, e.g. "18:20". */
  timer: string;
  paused: boolean;
  readAlong: boolean;
}
