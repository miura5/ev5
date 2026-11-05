import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { libraryArea } from "../areas/library/area.ts";
import { createReadCopy, memoryCopyStore } from "./readCopy.ts";

const Library = libraryArea.view;
const services = (readCopy: ReturnType<typeof createReadCopy>) =>
  ({ readCopy, outbox: { enqueue: async () => undefined } }) as never;

// Library through the shell's real read copy: the shell hands services.readCopy to the screen (§data.offline).
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const set = {
  schema: 3,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "test",
  kind: "drill",
  title: "Doses",
  items: [
    { id: "q1", stem: "How many mL?", options: ["2 mL", "5 mL"], correct: [1] },
  ],
};
const body = (docs: unknown[]) =>
  new Response(JSON.stringify({ docs }), { status: 200 });
const showSets = async () => {
  // Sets sit on their own tab; wait until the lists have loaded (the tab is there from the first paint).
  await new Promise((r) => setTimeout(r, 50));
  fireEvent.click(screen.getByRole("tab", { name: /sets/i }));
};
const good = (url: string) =>
  url.endsWith("/jobs")
    ? new Response(JSON.stringify({ jobs: [] }), { status: 200 })
    : body(url.includes("collection=sets") ? [{ id: "s1", data: set }] : []);

test("online the lists save; offline the saved sets show; a 503 neither shows them nor overwrites the copy", async () => {
  localStorage.setItem("ev5.token", "t");
  const copy = createReadCopy(memoryCopyStore());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => good(String(u))),
  );
  render(<Library services={services(copy)} />);
  await showSets();
  await screen.findByText("Doses");
  cleanup();

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 503 })),
  );
  render(<Library services={services(copy)} />);
  await showSets();
  expect(screen.queryByText("Doses")).toBeNull();
  expect(copy.usingCopy()).toBe(false);
  cleanup();

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("offline");
    }),
  );
  render(<Library services={services(copy)} />);
  await showSets();
  await screen.findByText("Doses");
  expect(copy.usingCopy()).toBe(true);
});

test("a second visit opens on the saved lists at once, before the server answers (§ui.instant)", async () => {
  localStorage.setItem("ev5.token", "t");
  const copy = createReadCopy(memoryCopyStore());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => good(String(u))),
  );
  render(<Library services={services(copy)} />);
  await showSets();
  await screen.findByText("Doses");
  cleanup();

  // The server never answers this time: the saved sets still show, and the notice stays off (it is not offline).
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined)),
  );
  render(<Library services={services(copy)} />);
  await showSets();
  await screen.findByText("Doses");
  expect(copy.usingCopy()).toBe(false);
});
