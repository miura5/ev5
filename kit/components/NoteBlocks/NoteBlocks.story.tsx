import { NoteBlocks, type NoteBlockShape } from "./NoteBlocks";

const t = (text: string) => [{ text }];
const blocks: NoteBlockShape[] = [
  { type: "h1", runs: t("Supply and demand") },
  { type: "h2", runs: t("The idea") },
  {
    type: "p",
    runs: [{ text: "Price follows " }, { text: "supply", b: true }],
  },
  { type: "ul", runs: t("Demand") },
  { type: "ul", indent: 1, runs: t("Consumer income") },
  { type: "todo", runs: t("Say the idea"), checked: true },
  { type: "todo", runs: t("Name an example") },
  { type: "img", runs: [], alt: "Price curve", row: "r1", col: 0 },
  { type: "p", runs: t("Beside the picture."), row: "r1", col: 1 },
];

export function Story() {
  return (
    <div data-ui="story-note-blocks">
      <NoteBlocks blocks={blocks} />
      <NoteBlocks blocks={blocks} title="Supply and demand" onToggle={() => {}} />
    </div>
  );
}
