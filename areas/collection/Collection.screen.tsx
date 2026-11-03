import { CollectionView } from "./Collection.view.tsx";

/** The mounted view until the collection data wiring lands: an empty, unpinned collection. */
export function CollectionScreen() {
  return <CollectionView title="" items={[]} dates={[]} nested={[]} />;
}
