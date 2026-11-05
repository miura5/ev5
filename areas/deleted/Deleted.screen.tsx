import { useEffect } from "react";
import { DeletedView } from "./Deleted.view.tsx";
import { useDeleted, type ReadCopyLike } from "./useDeleted.ts";

/** The mounted view: soft-deleted items from /api/v1/deletions; Restore puts an item back through item.restore. */
export function DeletedScreen({
  services,
  onToast,
}: {
  services?: { readCopy?: ReadCopyLike };
  onToast?: (message: string) => void;
}) {
  const { items, token, refused, error, restore } = useDeleted(services?.readCopy);
  useEffect(() => {
    if (error && token && !refused) onToast?.(error);
  }, [error, token, refused, onToast]);
  // No token, or one the server refused: no data and no "nothing here"; the shell's token screen asks for it.
  if (!token || refused) return null;
  return (
    <>
      <DeletedView items={items} onRestore={(id) => void restore(id)} />
    </>
  );
}
