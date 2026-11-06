import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CollectionScreen } from "./Collection.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("Delete on a collection goes to Notes with an Undo, never on to another collection", async () => {
  localStorage.setItem("ev5.token", "t");
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${u}`);
      const body = u.includes("/collections")
        ? {
            collections: [
              { id: "c1", title: "Biology 101", parentId: null, pos: 0 },
            ],
          }
        : u.includes("/memberships")
          ? { memberships: [] }
          : u.includes("/pins")
            ? { pins: [] }
            : u.includes("/deletions")
              ? { deletions: [] }
              : u.includes("/commands")
                ? { ok: true, mode: "direct", result: {} }
                : { docs: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  const go = vi.fn();
  render(<CollectionScreen path="/collection/c1" onNavigate={go} />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  await waitFor(() =>
    expect(go).toHaveBeenCalledWith("/notes?deleted=c1&what=collection"),
  );
  expect(go).not.toHaveBeenCalledWith("/collection");
});
