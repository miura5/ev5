import { DeletedView } from "./Deleted.view.tsx";

/** The mounted view until the deleted-items data wiring lands: nothing deleted yet. */
export function DeletedScreen() {
  return <DeletedView items={[]} />;
}
