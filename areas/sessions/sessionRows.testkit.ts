import {
  newSessionEventRow,
  newNoteRow,
  newSessionRow,
  parseNote,
  parseSession,
} from "../../domain/index.ts";

/** A session as the old document the tests write it in. */
export interface TestSession {
  id: string;
  v?: number;
  data: object;
}

/** What GET /sessions and GET /session-events answer for these sessions, by the url asked (§data.gate). */
export function sessionRowsBody(
  url: string,
  docs: readonly TestSession[],
): { rows: object[] } {
  const events = url.includes("session-events");
  return {
    rows: docs.flatMap((d): object[] => {
      const doc = parseSession(d.data);
      if (!events)
        return [
          {
            ...newSessionRow(d.id, doc),
            at: Date.parse(doc.at),
            v: d.v ?? 1,
            deleted_at: null,
          },
        ];
      return Object.entries(doc.events ?? {}).map(([k, e]) => ({
        ...newSessionEventRow(d.id, k, e),
        v: 1,
      }));
    }),
  };
}

/** What GET /notes/:id answers for a note written as a document with its version (§data.gate). */
export function noteRowBody(
  id: string,
  n: { v?: number; data: object },
): object {
  const doc = parseNote(n.data);
  return {
    ...newNoteRow(id, doc, null),
    at: Date.parse(doc.at),
    v: n.v ?? 1,
    deleted_at: null,
  };
}
