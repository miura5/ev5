import {
  createOutbox,
  docsHttp,
  indexedDbStore,
  importEv4Outbox,
  readEv4Outbox,
  type DocRow,
  type Ev4Entry,
  type Outbox,
} from "./outbox/index.ts";
import { createReadCopy, indexedDbCopyStore, type ReadCopy } from "./readCopy.ts";

/** What the shell hands every area view: reads over the document routes and the offline outbox. */
export interface Services {
  docs: { list(collection: string): Promise<DocRow[]> };
  /** The saved copy of reads: lets the shell say when the screen shows it. */
  readCopy?: ReadCopy;
  outbox: Pick<Outbox, "queueNote" | "queueAnswer" | "replay" | "count">;
  /** ev4's unsent notes on this device, offered once on first boot; absent when there is nothing to offer. */
  ev4?: {
    find(): Promise<Ev4Entry[]>;
    /** Matt's yes: queue the entries, then remember the answer. */
    accept(entries: Ev4Entry[]): Promise<{ queued: number }>;
    /** Matt's no: remember it. ev4's own box is left as it is. */
    decline(): void;
  };
}

export const EV4_ANSWER_KEY = "ev5.ev4-import";

const answered = (): boolean => {
  try {
    return localStorage.getItem(EV4_ANSWER_KEY) !== null;
  } catch {
    return false;
  }
};
const remember = (answer: string) => {
  try {
    localStorage.setItem(EV4_ANSWER_KEY, answer);
  } catch {
    /* the offer may come back; importing twice is the only cost */
  }
};

export function createServices(): Services {
  const http = docsHttp();
  const outbox = createOutbox({
    store: indexedDbStore(),
    transport: http.transport,
  });
  const ev4: NonNullable<Services["ev4"]> = {
    // Never throws: no ev4 database, or one that cannot be read, is simply nothing to offer.
    find: async () => (answered() ? [] : await readEv4Outbox().catch(() => [])),
    accept: async (entries) => {
      const done = await importEv4Outbox(outbox, entries);
      remember("imported");
      return done;
    },
    decline: () => remember("declined"),
  };
  const readCopy = createReadCopy(indexedDbCopyStore());
  const list = (c: string) => readCopy.read(`docs:${c}`, () => http.list(c));
  return { docs: { list }, readCopy, outbox, ev4 };
}
