import { Toast } from "../../kit/index.ts";
import { DeletedView } from "./Deleted.view.tsx";
import { useDeleted, type ReadCopyLike } from "./useDeleted.ts";

/** The mounted view: soft-deleted items from /api/v1/deletions; Restore is not wired yet (read only). */
export function DeletedScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { items, token, refused, error } = useDeleted(services?.readCopy);
  // No token, or one the server refused: no data and no "nothing here"; the shell's token screen asks for it.
  if (!token || refused) return null;
  return (
    <>
      {error ? <Toast message={error} /> : null}
      <DeletedView items={items} />
    </>
  );
}
