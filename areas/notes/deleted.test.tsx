import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { noteDoc } from "../../domain/index.ts";
import { readDeletedNoteIds } from "./collections.ts";
import { useNotes, type NotesServices } from "./useNotes.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const note = (title: string) =>
  noteDoc(null, {
    blocks: [{ type: "h1", runs: [{ text: title }] }],
    at: "2026-11-01T10:00:00.000Z",
  });

const services = (): NotesServices => ({
  docs: {
    list: async () => [
      { id: "n1", v: 1, at: 1, data: note("Kept") },
      { id: "n2", v: 1, at: 2, data: note("Gone") },
    ],
  },
  outbox: {
    queueNote: async () => undefined,
    replay: async () => ({ refused: [] }),
  },
});

const serve = (bodies: Record<string, unknown>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const key = Object.keys(bodies).find((k) => String(url).includes(`/${k}`));
      return new Response(JSON.stringify(key ? bodies[key] : {}), {
        status: 200,
      });
    }),
  );

test("a deleted note is out of Notes and its collection filing until restored", async () => {
  localStorage.setItem("ev5.token", "t");
  const bodies: Record<string, unknown> = {
    collections: { collections: [{ id: "c1", title: "Biology 101" }] },
    memberships: {
      memberships: [
        { collection: "notes", id: "n1", collectionId: "c1" },
        { collection: "notes", id: "n2", collectionId: "c1" },
      ],
    },
    deletions: { deletions: [{ collection: "notes", id: "n2", at: 3 }] },
  };
  serve(bodies);
  const svc = services();
  const { result, rerender } = renderHook(
    ({ s }) => useNotes(s),
    { initialProps: { s: svc } },
  );
  await waitFor(() => expect(result.current.notes).toHaveLength(1));
  expect(result.current.notes.map((n) => n.id)).toEqual(["n1"]);
  expect([...result.current.members.keys()]).toEqual(["n1"]);

  bodies.deletions = { deletions: [] }; // restored
  rerender({ s: services() });
  await waitFor(() => expect(result.current.notes).toHaveLength(2));
  expect([...result.current.members.keys()].sort()).toEqual(["n1", "n2"]);
});

test("only deleted notes are listed, and an unreadable list hides nothing", async () => {
  serve({
    deletions: {
      deletions: [
        { collection: "notes", id: "n1", at: 1 },
        { collection: "cards", id: "k1", at: 1 },
      ],
    },
  });
  expect([...(await readDeletedNoteIds())]).toEqual(["n1"]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 500 })),
  );
  expect((await readDeletedNoteIds()).size).toBe(0);
});
