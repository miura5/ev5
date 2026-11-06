import {
  createOutbox,
  docsHttp,
  indexedDbStore,
  type DocRow,
  type Outbox,
} from "./outbox/index.ts";
import { createReadCopy, indexedDbCopyStore, type ReadCopy } from "./readCopy.ts";

/** What the shell hands every area view: reads over the document routes and the offline outbox. */
export interface Services {
  /** With `copy` (the read copy's saved-only reader) the list comes from the saved copy, never the server. */
  docs: {
    list(
      collection: string,
      copy?: { read<T>(k: string, f: () => Promise<T>): Promise<T> },
    ): Promise<DocRow[]>;
  };
  /** The saved copy of reads: lets the shell say when the screen shows it. */
  readCopy?: ReadCopy;
  outbox: Pick<Outbox, "queueNote" | "queueAnswer" | "queueCommand" | "replay" | "count" | "waiting">;
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
  ) => copy.read(`docs:${c}`, () => http.list(c));
  return { docs: { list }, readCopy, outbox };
}
