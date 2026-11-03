import { NotesView } from "./Notes.view.tsx";

/** The mounted view until the data wiring lands: no notes, no collections. */
export function NotesScreen() {
  return <NotesView notes={[]} collections={[]} />;
}
