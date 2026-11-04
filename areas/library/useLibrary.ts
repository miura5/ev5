import { useEffect, useState } from "react";
import { mapLibrary } from "./map.ts";
import type { LibraryData, WireDoc } from "./map.ts";
import {
  ApiError,
  api,
  failureKind,
  failureSentence,
  readToken,
} from "../../commands/client.ts";

export interface LibraryState {
  data?: LibraryData;
  token: string;
  error?: string;
}

/** The shell's saved-copy reader (shell/readCopy.ts), restated: areas never import the shell. */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

/** Offline (a rejected fetch) the saved copy answers; a 401 or 5xx throws and is never kept as the copy (§data.offline). */
function list(
  collection: string,
  token: string,
  copy?: ReadCopyLike,
): Promise<WireDoc[]> {
  const fetcher = async (): Promise<WireDoc[]> => {
    const r = await api(`docs?collection=${collection}`, token);
    if (!r.ok) throw new ApiError(r.status);
    return ((await r.json()) as { docs: WireDoc[] }).docs;
  };
  return copy ? copy.read(`library:${collection}`, fetcher) : fetcher();
}

/** Reads exams, weak spots and sets with the app token Matt keeps in this browser (the shell holds none). */
export function useLibrary(copy?: ReadCopyLike): LibraryState {
  const [token] = useState(readToken);
  const [data, setData] = useState<LibraryData>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!token) return;
    let live = true;
    void (async () => {
      try {
        const [exams, weakspots, sets] = await Promise.all([
          list("exams", token, copy),
          list("weakspots", token, copy),
          list("sets", token, copy),
        ]);
        if (live) {
          setData(mapLibrary({ exams, weakspots, sets }, Date.now()));
          setError(undefined);
        }
      } catch (e) {
        // A refused token shows nothing here: the shell's token screen takes over.
        if (live)
          setError(
            failureKind(e) === "refused" ? undefined : failureSentence(e),
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [token, copy]);
  return { data, token, error };
}
