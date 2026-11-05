import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Shell } from "./Shell.tsx";

afterEach(cleanup);

const areas = [
  { id: "today", route: "/", nav: "Today", view: () => <h1>Today view</h1> },
];

test("a note in Recently deleted is not offered by ⌘K, and is again once restored", async () => {
  localStorage.setItem("ev5.token", "t");
  let deletions: unknown[] = [{ collection: "notes", id: "n-1", at: 3 }];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(JSON.stringify({ deletions }), { status: 200 }),
    ),
  );
  const rows = {
    notes: [{ id: "n-1", v: 1, at: 1, data: { title: "Heart failure" } }],
  } as Record<string, { id: string; v: number; at: number; data: unknown }[]>;
  const services = {
    docs: { list: async (c: string) => rows[c] ?? [] },
    outbox: {},
  } as unknown as NonNullable<Parameters<typeof Shell>[0]["services"]>;
  const open = async () => {
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await new Promise((r) => setTimeout(r, 20));
    fireEvent.input(screen.getByPlaceholderText(/Type a command/), {
      target: { value: "heart" },
    });
    return (await screen.findAllByRole("option")).map((o) => o.textContent);
  };
  const view = render(
    <Shell path="/" onNavigate={vi.fn()} areas={areas} services={services} />,
  );
  expect((await open()).some((n) => n?.includes("Heart failure"))).toBe(false);
  fireEvent.keyDown(window, { key: "Escape" });
  view.unmount();
  deletions = []; // restored
  render(
    <Shell path="/" onNavigate={vi.fn()} areas={areas} services={services} />,
  );
  expect((await open()).some((n) => n?.includes("Heart failure"))).toBe(true);
  vi.unstubAllGlobals();
  localStorage.clear();
});
