import { useEffect, useRef, useState } from "react";
import { mapCollection, mapPins } from "./map.ts";
import type {
  CollectionData,
  DocsByCollection,
  WireCollection,
  NamedRow,
  WireMembership,
  WirePin,
} from "./map.ts";
import type { CollectionEntry } from "./Collection.view.tsx";
import {
  failureKind,
  failureSentence,
  readJson,
  readToken,
  savedFirst,
} from "../../commands/client.ts";

export interface CollectionState {
  data?: CollectionData;
  /** Pinned items from /api/v1/pins; empty when none or the read fails. */
  pins: CollectionEntry[];
  loaded: boolean;
  token: string;
  /** The server refused the token (401): no data and no empty state; the shell's token screen takes over. */
  refused: boolean;
  /** A plain sentence for any other failure. */
  error?: string;
  /** Read everything again (after a pin or delete). */
  reload: () => void;
}

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

/** Offline (a rejected fetch) the saved copy answers; a 401 or 5xx throws and is never kept (§data.offline). */
function get<T>(path: string, token: string, copy?: ReadCopyLike): Promise<T> {
  return readJson<T>(path, token, `collection:/api/v1/${path}`, copy);
}

/** The row route that names each kind of member; a kind with no route keeps "Untitled". */
const ROUTES: Record<string, string> = {
  notes: "notes",
  sets: "sets",
  goals: "goals",
  weakspots: "weak-spots",
};
/** A weak spot's name is its topic; the rest carry a title. */
const named = (r: Record<string, unknown>): NamedRow => {
  const t = typeof r.title === "string" ? r.title : r.topic;
  return {
    id: String(r.id),
    title: typeof t === "string" ? t : undefined,
    kind: typeof r.kind === "string" ? r.kind : undefined,
    at: typeof r.at === "number" ? r.at : undefined,
  };
};

/** Reads collections, memberships and pins with the app token Matt keeps in this browser. */
export function useCollection(
  id?: string,
  copy?: ReadCopyLike,
): CollectionState {
  const token = readToken();
  const [data, setData] = useState<CollectionData>();
  const [pins, setPins] = useState<CollectionEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState(false);
  const [tick, setTick] = useState(0);
  const lastTick = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const load = async (c: ReadCopyLike | undefined) => {
      const [col, m, p, del] = await Promise.all([
        get<{ collections: WireCollection[] }>("collections", token, c),
        get<{ memberships: WireMembership[] }>("memberships", token, c),
        // A pins read that fails leaves the list empty; the collection itself still shows.
        get<{ pins: WirePin[] }>("pins", token, c).catch(() => ({
          pins: [] as WirePin[],
        })),
        // Items in Recently deleted stay out until restored; an unreadable list hides nothing.
        get<{ deletions: { collection: string; id: string }[] }>(
          "deletions",
          token,
          c,
        ).catch(() => ({ deletions: [] })),
      ]);
      const gone = new Set(
        (Array.isArray(del.deletions) ? del.deletions : []).map(
          (x) => `${x.collection}/${x.id}`,
        ),
      );
      const alive = (x: { collection: string; id: string }) =>
        !gone.has(`${x.collection}/${x.id}`);
      m.memberships = m.memberships.filter(alive);
      p.pins = p.pins.filter(alive);
      const kinds = [
        ...new Set([
          ...m.memberships.map((x) => x.collection),
          ...p.pins.map((x) => x.collection),
        ]),
      ];
      const docs: DocsByCollection = {};
      await Promise.all(
        kinds.map(async (k) => {
          try {
            const route = ROUTES[k];
            if (!route) return;
            const body = await get<{ rows: Record<string, unknown>[] }>(
              route,
              token,
              c,
            );
            docs[k] = body.rows.map(named);
          } catch {
            // titles fall back to ids for a kind that will not load
          }
        }),
      );
      return { col, m, p, docs };
    };
    // Opening a collection paints the last answer kept, then the server's (§ui.instant); a reload after a change does not.
    const warm = lastTick.current === undefined || lastTick.current === tick;
    lastTick.current = tick;
    savedFirst(copy, warm, load, ({ col, m, p, docs }) => {
      if (!live) return;
      setData(mapCollection(col.collections, m.memberships, id, docs));
      setPins(mapPins(p.pins, docs));
      setLoaded(true);
      setError(undefined);
      setRefused(false);
    }).catch((e: unknown) => {
      if (!live) return;
      setData(undefined);
      setPins([]);
      setRefused(failureKind(e) === "refused");
      setError(failureSentence(e));
    });
    return () => {
      live = false;
    };
  }, [token, id, copy, tick]);
  return {
    data,
    pins,
    loaded,
    token,
    refused,
    error,
    reload: () => setTick((t) => t + 1),
  };
}
