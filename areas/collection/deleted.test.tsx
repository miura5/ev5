import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useCollection } from "./useCollection.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("an item in Recently deleted is out of the collection and the pins until restored", async () => {
  localStorage.setItem("ev5.token", "t");
  const bodies: Record<string, unknown> = {
    collections: {
      collections: [{ id: "c1", title: "Biology 101", parentId: null, pos: 0 }],
    },
    memberships: {
      memberships: [
        { collection: "notes", id: "n1", collectionId: "c1", at: 1 },
        { collection: "notes", id: "n2", collectionId: "c1", at: 2 },
      ],
    },
    pins: { pins: [{ collection: "notes", id: "n2", pos: 0, at: 2 }] },
    docs: { docs: [] },
    deletions: { deletions: [{ collection: "notes", id: "n2", at: 3 }] },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const key =
        Object.keys(bodies).find((k) => String(url).includes(`/${k}`)) ??
        "docs";
      return new Response(JSON.stringify(bodies[key]), { status: 200 });
    }),
  );
  const { result } = renderHook(() => useCollection("c1"));
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.data?.items.map((i) => i.id)).toEqual(["n1"]);
  expect(result.current.pins).toEqual([]);

  bodies.deletions = { deletions: [] }; // restored
  result.current.reload();
  await waitFor(() =>
    expect(result.current.data?.items.map((i) => i.id)).toEqual(["n2", "n1"]),
  );
  expect(result.current.pins.map((p) => p.id)).toEqual(["n2"]);
});

test("members are named through the row routes, never /docs", async () => {
  localStorage.setItem("ev5.token", "t");
  const bodies: Record<string, unknown> = {
    collections: {
      collections: [{ id: "c1", title: "Biology 101", parentId: null, pos: 0 }],
    },
    memberships: {
      memberships: [
        { collection: "weakspots", id: "ws_1", collectionId: "c1", at: 1 },
        { collection: "goals", id: "goal_1", collectionId: "c1", at: 2 },
      ],
    },
    pins: { pins: [] },
    deletions: { deletions: [] },
    "weak-spots": { rows: [{ id: "ws_1", topic: "Heart rhythms", at: 5 }] },
    goals: { rows: [{ id: "goal_1", title: "Unit 3 exam", kind: "exam" }] },
  };
  const seen: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      seen.push(String(url));
      const key = Object.keys(bodies).find((k) =>
        String(url).endsWith(`/${k}`),
      );
      return new Response(JSON.stringify(key ? bodies[key] : {}), {
        status: 200,
      });
    }),
  );
  const { result } = renderHook(() => useCollection("c1"));
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.data?.items.map((i) => i.title)).toEqual([
    "Unit 3 exam",
    "Heart rhythms",
  ]);
  expect(result.current.data?.items[0]!.meta).toMatch(/^Date · exam · /);
  expect(seen.some((u) => u.includes("/docs"))).toBe(false);
});
