import {
  createOutbox,
  docsHttp,
  indexedDbStore,
  type DocRow,
  type Outbox,
} from "./outbox/index.ts";

/** What the shell hands every area view: reads over the document routes and the offline outbox. */
export interface Services {
  docs: { list(collection: string): Promise<DocRow[]> };
  outbox: Pick<Outbox, "queueNote" | "replay" | "count">;
}

export function createServices(): Services {
  const http = docsHttp();
  const outbox = createOutbox({
    store: indexedDbStore(),
    transport: http.transport,
  });
  return { docs: { list: http.list }, outbox };
}
