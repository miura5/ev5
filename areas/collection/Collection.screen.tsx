import { Toast } from "../../kit/index.ts";
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
  const { data, pins, token, refused, error } = useCollection(
    idOf(path),
    services?.readCopy,
  );
  // No token, or one the server refused: no data and no "nothing here"; the shell's token screen asks for it.
  if (!token || refused) return null;
  return (
    <>
      {error ? <Toast message={error} /> : null}
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
        onOpen={(eid) => {
          if (data?.nested.some((n) => n.id === eid))
            onNavigate?.(`/collection/${encodeURIComponent(eid)}`);
        }}
      />
    </>
  );
}
