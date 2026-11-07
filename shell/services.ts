import {
  createOutbox,
  docsHttp,
  indexedDbStore,
  type DocRow,
  type Outbox,
} from "./outbox/index.ts";
import { reloadHold } from "./pwa.ts";
import {
  createReadCopy,
  indexedDbCopyStore,
  type ReadCopy,
} from "./readCopy.ts";

/** What the shell hands every area view: reads over the row routes and the offline outbox. */
export interface Services {
  /** With `copy` (the read copy's saved-only reader) the list comes from the saved copy, never the server. */
  rows: {
    list(
      collection: string,
      copy?: { read<T>(k: string, f: () => Promise<T>): Promise<T> },
    ): Promise<DocRow[]>;
  };
  /** The saved copy of reads: lets the shell say when the screen shows it. */
  readCopy?: ReadCopy;
  /** Holds a new build's reload while a study run is open; call the returned function when it ends. */
  holdReload?: () => () => void;
  outbox: Pick<
    Outbox,
    "queueNote" | "queueCommand" | "onRefused" | "replay" | "count" | "waiting"
  >;
}

export function createServices(): Services {
  const http = docsHttp();
  const outbox = createOutbox({
    store: indexedDbStore(),
    transport: http.transport,
  });
  const readCopy = createReadCopy(indexedDbCopyStore());
  const list = (
    c: string,
    copy: { read<T>(k: string, f: () => Promise<T>): Promise<T> } = readCopy,
  ) => copy.read(`rows:${c}`, () => http.list(c));
  return {
    rows: { list },
    readCopy,
    outbox,
    holdReload: () => reloadHold.hold(),
  };
}
