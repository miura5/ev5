/** A background job a reply points at (restated here; areas may not import jobs/). */
export interface AskJob {
  title: string;
  meta: string;
  value?: string;
  running?: boolean;
}

/** One turn in the chat, in the order it happened. */
export type AskMessage =
  | { id: string; from: "you"; at: string; text: string }
  | {
      id: string;
      from: "ev";
      text: string;
      /** The note the answer came from; leave out when nothing backs it. */
      source?: string;
      /** E.V. is waiting for the user's try: show "Just tell me". */
      asksTry?: boolean;
      /** What "Just tell me" shows, once the tap is logged. */
      answer?: string;
      job?: AskJob;
      /** A day or time break drawn above this turn. */
      breakBefore?: boolean;
    };
