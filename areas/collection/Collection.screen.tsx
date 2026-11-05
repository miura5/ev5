import { useState } from "react";
import { Toast } from "../../kit/index.ts";
import { call } from "../../commands/client.ts";
import { CollectionView } from "./Collection.view.tsx";
import { useCollection, type ReadCopyLike } from "./useCollection.ts";

/** The mounted view: the collection named by /collection/:id, else the first one, from /api/v1/collections and /memberships; empty until the tables exist. */
const idOf = (path?: string) => {
  const m = /^\/collection\/([^/]+)/.exec(path ?? "");
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
};

export function CollectionScreen({
  path,
  onNavigate,
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
  path?: string;
  onNavigate?: (path: string) => void;
}) {
  const { data, pins, token, refused, error, reload } = useCollection(
    idOf(path),
    services?.readCopy,
  );
  const [failed, setFailed] = useState<string>();
  const open = (eid: string) => {
    if (data?.nested.some((n) => n.id === eid))
      return onNavigate?.(`/collection/${encodeURIComponent(eid)}`);
    const to = [...(data?.items ?? []), ...pins].find((x) => x.id === eid)?.to;
    if (to) onNavigate?.(to);
  };
  // No token, or one the server refused: no data and no "nothing here"; the shell's token screen asks for it.
  if (!token || refused) return null;
  // First read still on its way: a loading line, never "Untitled collection, 0 items".
  if (!data && !error)
    return <p className="ev-coll-empty">Opening the collection…</p>;
  return (
    <>
      {error || failed ? <Toast message={(error ?? failed)!} /> : null}
      <CollectionView
        title={data?.title ?? ""}
        parent={data?.parent}
        dates={[]}
        pinnedItems={pins}
        nested={data?.nested ?? []}
        items={data?.items ?? []}
        onBack={
          data?.parentId
            ? () =>
                onNavigate?.(
                  `/collection/${encodeURIComponent(data.parentId!)}`,
                )
            : undefined
        }
        onDelete={
          data
            ? () =>
                void call("item.delete", { id: data.id }, token).then((r) => {
                  setFailed(r.ok ? undefined : r.reason);
                  if (r.ok) {
                    onNavigate?.("/collection");
                    reload();
                  }
                })
            : undefined
        }
        onOpen={open}
        onItemAction={(eid, action) => {
          if (action === "open") return open(eid);
          void call(`item.${action}`, { id: eid }, token).then((r) => {
            setFailed(r.ok ? undefined : r.reason);
            if (r.ok) reload();
          });
        }}
      />
    </>
  );
}
