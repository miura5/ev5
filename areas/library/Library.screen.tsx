import { LibraryView } from "./Library.view.tsx";

/** The mounted view until the data wiring lands: nothing practised, no weak spots, no exams. */
export function LibraryScreen() {
  return <LibraryView practice={null} weakSpots={[]} exams={[]} />;
}
