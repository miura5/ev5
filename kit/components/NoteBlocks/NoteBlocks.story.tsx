import { NoteBlocks, type NoteBlockShape } from "./NoteBlocks";

const t = (text: string) => [{ text }];
const blocks: NoteBlockShape[] = [
  { type: "h1", runs: t("Cardiac output") },
  { type: "h2", runs: t("The formula") },
  {
    type: "p",
    runs: [{ text: "Heart rate times " }, { text: "stroke volume", b: true }],
  },
  { type: "ul", runs: t("Preload") },
  { type: "ul", indent: 1, runs: t("Venous return") },
  { type: "todo", runs: t("Say the formula"), checked: true },
  { type: "todo", runs: t("Name the units") },
  { type: "img", runs: [], alt: "Pressure curve", row: "r1", col: 0 },
  { type: "p", runs: t("Beside the picture."), row: "r1", col: 1 },
];

export function Story() {
  return (
    <div data-ui="story-note-blocks">
      <NoteBlocks blocks={blocks} />
      <NoteBlocks blocks={blocks} title="Cardiac output" onToggle={() => {}} />
    </div>
  );
}
