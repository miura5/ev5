import { useState } from "react";
import { DeletedView } from "./Deleted.view.tsx";
import { useDeleted, type ReadCopyLike } from "./useDeleted.ts";

/** The mounted view: soft-deleted items from /api/v1/deletions; Restore is not wired yet (read only). */
export function DeletedScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { items, token, error, setToken } = useDeleted(services?.readCopy);
  const [draft, setDraft] = useState("");
  if (!token)
    return (
      <form
        className="ev-deleted"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setToken(draft.trim());
        }}
      >
        <label className="ev-deleted-meta" htmlFor="ev-token">
          Paste your app token to see Recently deleted
        </label>
        <input
          id="ev-token"
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
    );
  return (
    <>
      {error ? <p className="ev-deleted-meta">{error}</p> : null}
      <DeletedView items={items} />
    </>
  );
}
