import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { noteRowBody, sessionRowsBody } from "./sessionRows.testkit.ts";
import { useSessions } from "./useSessions.ts";

/** Stands in for the shell's ReadCopy (areas never import the shell): a good read is kept; a rejected fetch gets it back. */
function fakeCopy(kept: Record<string, unknown> = {}) {
  return {
    kept,
    async read<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
      try {
        const v = await fetcher();
        kept[key] = v;
        return v;
      } catch (e) {
        if (!(e instanceof TypeError) || !(key in kept)) throw e;
        return kept[key] as T;
      }
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const stub = (f: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(f));
const offline = () =>
  stub(async () => {
    throw new TypeError("offline");
  });
const status = (n: number) =>
  stub(async () => new Response("{}", { status: n }));
const doc = {
  id: "s1",
  v: 3,
  data: {
    schema: 2,
    writer: "page",
    at: "2026-11-04T15:00:00.000Z",
    source: "E.V. Home",
    date: "2026-11-04",
    topic: "Energy budget",
    status: "active",
    startedAt: "2026-11-04T15:00:00.000Z",
  },
};
/** The server answers the session rows and the event rows by the url asked. */
const ok = (docs: object[]) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(sessionRowsBody(url, docs as never)), {
          status: 200,
        }),
    ),
  );
const saved: Record<string, unknown> = {
  "sessions:rows": sessionRowsBody("sessions", [doc]).rows,
  "sessions:events": [],
};
const ready = (s: { data?: unknown }) => s.data !== undefined;
const use = () => localStorage.setItem("ev5.token", "t");

test("offline, the saved copy shows and no error is raised", async () => {
  use();
  offline();
  const { result } = renderHook(() => useSessions(fakeCopy(saved)));
  await waitFor(() => expect(ready(result.current)).toBe(true));
  expect(result.current.error).toBeUndefined();
});

test("a server error shows the error and keeps the saved copy", async () => {
  use();
  status(503);
  const copy = fakeCopy(saved);
  const { result } = renderHook(() => useSessions(copy));
  await waitFor(() =>
    expect(result.current.error).toBe(
      "Something went wrong on E.V.'s side. Try again in a moment.",
    ),
  );
  expect(copy.kept).toEqual(saved);
});

test("a 401 is not answered from the copy", async () => {
  use();
  status(401);
  const copy = fakeCopy(saved);
  const { result } = renderHook(() => useSessions(copy));
  await waitFor(() => expect(result.current.refused).toBe(true));
  expect(ready(result.current)).toBe(false);
  expect(copy.kept).toEqual(saved);
});

test("a good read refreshes the copy", async () => {
  use();
  ok([doc]);
  const copy = fakeCopy();
  const { result } = renderHook(() => useSessions(copy));
  await waitFor(() => expect(ready(result.current)).toBe(true));
  expect(Object.keys(copy.kept).sort()).toEqual([
    "sessions:events",
    "sessions:rows",
  ]);
});

const withNote = { ...doc, data: { ...doc.data, noteId: "note_n1" } };
const noteDoc = {
  v: 2,
  data: {
    schema: 1,
    writer: "page",
    at: "2026-11-04T15:00:00.000Z",
    createdAt: "2026-11-04T15:00:00.000Z",
    title: "Heart",
    blocks: [],
  },
};
const note = noteRowBody("note_n1", noteDoc);

test("offline, the note read-along comes from the saved copy", async () => {
  use();
  offline();
  const copy = fakeCopy({
    "sessions:rows": sessionRowsBody("sessions", [withNote]).rows,
    "sessions:events": [],
    "sessions:note:note_n1": note,
  });
  const { result } = renderHook(() => useSessions(copy));
  await waitFor(() => expect(result.current.note).toBeDefined());
});

test("a 5xx on the note never overwrites its saved copy", async () => {
  use();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/notes/")
        ? new Response("{}", { status: 503 })
        : new Response(JSON.stringify(sessionRowsBody(url, [withNote])), {
            status: 200,
          }),
    ),
  );
  const copy = fakeCopy({ "sessions:note:note_n1": note });
  const { result } = renderHook(() => useSessions(copy));
  await waitFor(() => expect(result.current.data).toBeDefined());
  await new Promise((r) => setTimeout(r, 20));
  expect(result.current.note).toBeUndefined();
  expect(copy.kept["sessions:note:note_n1"]).toEqual(note);
});
