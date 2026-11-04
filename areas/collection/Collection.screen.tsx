import { useState } from "react";
import { CollectionView } from "./Collection.view.tsx";
import { useCollection } from "./useCollection.ts";

/** The mounted view: the first collection from /api/v1/collections and /memberships; empty until the tables exist. */
export function CollectionScreen() {
  const { data, token, error, setToken } = useCollection();
  const [draft, setDraft] = useState("");
  if (!token)
    return (
      <form
        className="ev-coll"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setToken(draft.trim());
        }}
      >
        <label className="ev-coll-meta" htmlFor="ev-token">
          Paste your app token to see your Collection
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
      {error ? <p className="ev-coll-meta">{error}</p> : null}
      <CollectionView
        title={data?.title ?? ""}
        parent={data?.parent}
        dates={[]}
        nested={data?.nested ?? []}
        items={data?.items ?? []}
      />
    </>
  );
}
