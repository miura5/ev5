// The outbox's transport (commands, and the notes row route for a stale save) and the page's reads: notes, dates, sets and weak spots over their /api/v1 row routes, any other collection over /api/v1/docs (server/doc-routes.ts). The app token is read at each
// call, so a token pasted in Activity works without a reload. A rejected fetch means offline; the outbox waits.
import { ApiError, call as runCommand, readToken } from "../../commands/client.ts";
import type { CommandName } from "../../commands/client.ts";
import { noteDocId, noteDocOf, noteRowId, parseNoteTableRow, type NoteTableRow } from "../../domain/index.ts";
import type { GetAnswer, PutAnswer, Transport } from "./types.ts";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** One document as the page reads it (GET /docs, or a notes row turned into one). */
export interface DocRow {
  id: string;
  v: number;
  at: number;
  data: unknown;
}

export const TOKEN_KEY = "ev5.token";

export function storedToken(): string {
  return readToken(); // falls back to this visit's token when storage is blocked
}

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
const json = async (r: Response): Promise<Record<string, unknown>> => {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** The row route behind each collection the page lists (server/row-routes.ts). */
const ROW_ROUTES: Record<string, string> = {
  exams: "goals",
  sets: "sets",
  weakspots: "weak-spots",
};

export function docsHttp(
  token: () => string = storedToken,
  doFetch: Fetch = (u, i) => fetch(u, i),
) {
  const call = (path: string, init: RequestInit = {}) =>
    doFetch(`/api/v1/docs${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        authorization: `Bearer ${token()}`,
      },
    });

  const transport: Transport = {
    async command(name, input): Promise<PutAnswer> {
      const r = await runCommand(name as CommandName, input, token());
      if (!r.ok && r.status === 0) throw new TypeError("offline"); // no connection: the outbox waits
      if (!r.ok) return { status: r.status, text: r.reason };
      const v = (r.result as { version?: unknown } | null | undefined)?.version;
      return { status: 200, ...(typeof v === 'number' ? { version: v } : {}) };
    },
    async get(id): Promise<GetAnswer> {
      const r = await doFetch(`/api/v1/notes/${encodeURIComponent(noteRowId(id))}`, {
        headers: { authorization: `Bearer ${token()}` },
      });
      if (!r.ok) return { status: r.status };
      const row = (await json(r)) as unknown as NoteTableRow;
      return { status: 200, version: row.v, data: noteDocOf(row) };
    },
  };

  /** The older /docs read; the one collection left on it is any this page has no row route for. */
  async function listCollection(c: string): Promise<DocRow[]> {
    const r = await call(`?${q({ collection: c })}`);
    if (!r.ok) throw new ApiError(r.status);
    return ((await json(r)).docs ?? []) as DocRow[];
  }

  /** Dates, sets and weak spots from their row routes; the palette needs a title (a weak spot's topic) and the id. */
  async function listRows(path: string): Promise<DocRow[]> {
    const r = await doFetch(`/api/v1/${path}`, {
      headers: { authorization: `Bearer ${token()}` },
    });
    if (!r.ok) throw new ApiError(r.status);
    const rows = ((await json(r)).rows ?? []) as Record<string, unknown>[];
    return rows.flatMap((row) =>
      typeof row.id === "string"
        ? [{ id: row.id, v: Number(row.v) || 0, at: Number(row.at) || 0, data: row }]
        : [],
    );
  }

  /** Every live note from GET /api/v1/notes as documents; a row that does not parse stays out. */
  async function listNotes(): Promise<DocRow[]> {
    const r = await doFetch("/api/v1/notes", {
      headers: { authorization: `Bearer ${token()}` },
    });
    if (!r.ok) throw new ApiError(r.status);
    const rows = ((await json(r)).rows ?? []) as unknown[];
    return rows.flatMap((raw) => {
      try {
        const row = parseNoteTableRow(raw);
        return [{ id: noteDocId(row.id), v: row.v, at: row.at, data: noteDocOf(row) }];
      } catch {
        return [];
      }
    });
  }

  /** Every document of a collection: from its row route, else /docs. */
  const list = (c: string): Promise<DocRow[]> =>
    c === "notes"
      ? listNotes()
      : ROW_ROUTES[c]
        ? listRows(ROW_ROUTES[c])
        : listCollection(c);

  return { transport, list };
}
