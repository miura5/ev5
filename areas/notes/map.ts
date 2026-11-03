import type { Note } from "../../domain/index.ts";
import type {
  NoteBlock,
  NoteBody,
  NotePageData,
  NoteSummary,
} from "./types.ts";
import type { SaveState } from "./useNotes.ts";

const words = (n: Note) =>
  n.blocks
    .map((b) => b.runs.map((r) => r.text).join(""))
    .find(
      (t, i) =>
        t.trim() && n.blocks[i]?.type !== "h1" && n.blocks[i]?.type !== "img",
    ) ?? "";

const day = (iso: string) => iso.slice(0, 10);

export function toSummary(id: string, n: Note): NoteSummary {
  return {
    id,
    title: n.title || "Untitled",
    preview: words(n),
    when: day(n.editedAt ?? n.at),
    collectionId: null,
  };
}

const toBlock = (b: Note["blocks"][number]): NoteBlock =>
  b.type === "img"
    ? { type: "img", alt: b.alt, width: b.width }
    : b.type === "todo"
      ? { type: "todo", indent: b.indent, checked: b.checked, runs: b.runs }
      : b.type === "ul" || b.type === "ol"
        ? { type: b.type, indent: b.indent, runs: b.runs }
        : { type: b.type, runs: b.runs };

/** Blocks sharing a `row` id become one two-column row, placed where the row's first block was. */
export function toBody(n: Note): NoteBody[] {
  const out: NoteBody[] = [];
  const rows = new Map<string, { left: NoteBlock[]; right: NoteBlock[] }>();
  for (const b of n.blocks) {
    if (!b.row) {
      out.push(toBlock(b));
      continue;
    }
    let row = rows.get(b.row);
    if (!row) {
      row = { left: [], right: [] };
      rows.set(b.row, row);
      out.push({ type: "row", id: b.row, ...row });
    }
    (b.col === 1 ? row.right : row.left).push(toBlock(b));
  }
  return out;
}

export function toPage(
  id: string,
  n: Note,
  saveState: SaveState,
): NotePageData {
  return {
    id,
    title: n.title || "Untitled",
    collectionName: n.course ?? null,
    edited: day(n.editedAt ?? n.at),
    saveState,
    body: toBody(n),
  };
}
