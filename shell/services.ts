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

/** What the shell hands every area view: reads over the document routes and the offline outbox. */
export interface Services {
  docs: { list(collection: string): Promise<DocRow[]> };
  outbox: Pick<Outbox, "queueNote" | "replay" | "count">;
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
  return { docs: { list: http.list }, outbox, ev4 };
}
