import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Shell } from "./Shell.tsx";
import * as client from "../commands/client.ts";

afterEach(cleanup);

const areas = [
  { id: "today", route: "/", nav: "Today", view: () => <h1>Today view</h1> },
  { id: "ask", route: "/ask", nav: "Ask E.V.", view: () => <h1>Ask view</h1> },
];

test("the sidebar is built from the areas and mounts the current view", () => {
  const onNavigate = vi.fn();
  render(<Shell path="/ask" onNavigate={onNavigate} areas={areas} />);
  expect(screen.getByText("Ask view")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(onNavigate).toHaveBeenCalledWith("/");
});

test("pins, the deleted count and the Detail panel show only when there is something", () => {
  const onOpenPin = vi.fn();
  const { rerender } = render(
    <Shell path="/" onNavigate={vi.fn()} areas={areas} />,
  );
  expect(screen.queryByText("Pinned")).toBeNull();
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
  rerender(
    <Shell
      path="/"
      onNavigate={vi.fn()}
      areas={areas}
      pins={[{ id: "n1", title: "Heart notes", type: "note" }]}
      onOpenPin={onOpenPin}
      deletedCount={2}
      detail={{ title: "Heart notes", properties: [] }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Heart notes/ }));
  expect(onOpenPin).toHaveBeenCalledWith("n1");
  expect(screen.getByText("2")).toBeTruthy();
  expect(document.querySelector("[data-ui='detail']")).toBeTruthy();
});

test("⌘K opens the palette, runs a place and Esc closes it", () => {
  const onNavigate = vi.fn();
  render(<Shell path="/" onNavigate={onNavigate} areas={areas} />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.click(screen.getByRole("option", { name: "Ask E.V." }));
  expect(onNavigate).toHaveBeenCalledWith("/ask");
  expect(document.querySelector("[data-ui='palette']")).toBeNull();
});

test("the sidebar shows counts, the running job and a search that opens ⌘K", () => {
  const onOpenJob = vi.fn();
  render(
    <Shell
      path="/"
      onNavigate={() => undefined}
      areas={areas}
      counts={{ today: 4 }}
      deletedCount={2}
      runningJob={{ id: "j1", text: "Writing mock exam · 3/4" }}
      onOpenJob={onOpenJob}
    />,
  );
  expect(screen.getByRole("button", { name: /^Today/ }).textContent).toContain(
    "4",
  );
  fireEvent.click(screen.getByRole("button", { name: /Writing mock exam/ }));
  expect(onOpenJob).toHaveBeenCalledWith("j1");
  fireEvent.click(screen.getByRole("button", { name: /Search or ask/ }));
  expect(screen.getByRole("option", { name: "Ask E.V." })).toBeTruthy();
});

test("the real sidebar lists the six areas in order, then Recently deleted once; routes are not entries", async () => {
  const { AREAS } = await import("./areas.ts");
  render(<Shell path="/today" onNavigate={() => undefined} areas={AREAS} />);
  const labels = Array.from(
    document.querySelectorAll('nav[aria-label="Primary"] button'),
  ).map((b) => b.textContent ?? "");
  const names = [
    "Today",
    "Ask E.V.",
    "Library",
    "Notes",
    "Progress",
    "Activity",
  ];
  const at = names.map((n) => labels.findIndex((l) => l.startsWith(n)));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
  expect(labels.filter((l) => l.startsWith("Recently deleted"))).toHaveLength(
    1,
  );
  for (const n of ["Hello", "Collection", "Sessions"])
    expect(labels.some((l) => l.startsWith(n))).toBe(false);
});

test("⌘K lists commands for this place and runs one through call()", () => {
  const spy = vi
    .spyOn(client, "call")
    .mockResolvedValue({ ok: true, mode: "direct" });
  render(<Shell path="/" onNavigate={vi.fn()} areas={areas} />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(screen.getByText("Commands")).toBeTruthy();
  expect(screen.queryByRole("option", { name: "New set" })).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: "Add a plan item" }));
  expect(spy).toHaveBeenCalledWith("plan.create", {}, expect.any(String));
  expect(document.querySelector("[data-ui='palette']")).toBeNull();
  spy.mockRestore();
});

test("Tab hands the typed text to Ask E.V., and ⌘J toggles Ask E.V.", () => {
  const onNavigate = vi.fn();
  const { rerender } = render(
    <Shell path="/" onNavigate={onNavigate} areas={areas} />,
  );
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "what is a ratio" },
  });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
  expect(onNavigate).toHaveBeenCalledWith("/ask?text=what%20is%20a%20ratio");
  onNavigate.mockClear();
  fireEvent.keyDown(window, { key: "j", ctrlKey: true });
  expect(onNavigate).toHaveBeenCalledWith("/ask");
  rerender(<Shell path="/ask" onNavigate={onNavigate} areas={areas} />);
  onNavigate.mockClear();
  fireEvent.keyDown(window, { key: "j", ctrlKey: true });
  expect(onNavigate).toHaveBeenCalledWith("/");
});

test("areaFor opens a parent route for a sub-path", async () => {
  const { areaFor } = await import("./areas.ts");
  expect(areaFor("/collection/abc")?.id).toBe("collection");
});

test("/deleted mounts Recently deleted's view", async () => {
  const { AREAS } = await import("./areas.ts");
  localStorage.setItem("ev5.token", "t");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [] })),
  );
  render(<Shell path="/deleted" onNavigate={() => undefined} areas={AREAS} />);
  expect(
    await screen.findByRole("heading", { name: /Recently deleted/ }),
  ).toBeTruthy();
});

test("the palette's Places match the sidebar and an empty group shows no header", async () => {
  const { AREAS } = await import("./areas.ts");
  render(<Shell path="/today" onNavigate={() => undefined} areas={AREAS} />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  const options = screen.getAllByRole("option").map((o) => o.textContent ?? "");
  for (const hidden of ["Collection", "Sessions", "Recently deleted"]) {
    expect(options.some((o) => o.startsWith(hidden))).toBe(false);
  }
  expect(options.some((o) => o.startsWith("Library"))).toBe(true);
  const places = AREAS.filter((a) => a.sidebar !== false).length;
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent?.includes("Commands") ?? false).toBe(
    options.length > places,
  );
});

test("the theme button, the \\ key and the palette command flip data-theme and keep the choice", () => {
  localStorage.clear();
  render(<Shell path="/" onNavigate={vi.fn()} areas={areas} />);
  const root = () =>
    document.querySelector("[data-ui='shell']")?.getAttribute("data-theme");
  expect(root()).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: /Light theme/ }));
  expect(root()).toBe("light");
  expect(localStorage.getItem("ev5.theme")).toBe("light");
  fireEvent.keyDown(window, { key: "\\" });
  expect(root()).toBe("dark");
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.click(
    screen.getByRole("option", { name: "Switch light and dark" }),
  );
  expect(root()).toBe("light");
  cleanup();
  render(<Shell path="/" onNavigate={vi.fn()} areas={areas} />);
  expect(root()).toBe("light");
  localStorage.clear();
});

test("typing part of a title in ⌘K lists the matching record above Ask E.V.; Enter opens it", async () => {
  const onNavigate = vi.fn();
  const rows = {
    exams: [{ id: "x1", v: 1, at: 1, data: { title: "Synthetic unit exam" } }],
    notes: [{ id: "n-1", v: 1, at: 1, data: { title: "Heart failure" } }],
    sets: [],
    weakspots: [{ id: "w1", v: 1, at: 1, data: { topic: "Synthroid dosing" } }],
  } as Record<string, { id: string; v: number; at: number; data: unknown }[]>;
  const services = {
    docs: { list: async (c: string) => rows[c] ?? [] },
    outbox: {},
  } as unknown as NonNullable<Parameters<typeof Shell>[0]["services"]>;
  render(
    <Shell
      path="/"
      onNavigate={onNavigate}
      areas={[
        ...areas,
        { id: "library", route: "/library", nav: "Library", view: () => null },
      ]}
      services={services}
    />,
  );
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  await new Promise((r) => setTimeout(r, 20));
  const input = screen.getByPlaceholderText(/Type a command/);
  fireEvent.input(input, { target: { value: "synth" } });
  const rowsShown = await screen.findAllByRole("option");
  const names = rowsShown.map((r) => r.textContent);
  expect(names[0]).toContain("Synthetic unit exam");
  expect(names.some((n) => n?.includes("Synthroid dosing"))).toBe(true);
  expect(names.some((n) => n?.includes("Heart failure"))).toBe(false);
  expect(names[names.length - 1]).toContain("Ask E.V.: synth");
  fireEvent.click(rowsShown[0]!);
  expect(onNavigate).toHaveBeenCalledWith("/library?open=x1");
});

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

/** One key as the browser delivers it: keydown, the native value change with its input event, keyup. */
function typeKeys(input: HTMLInputElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  input.focus();
  for (const ch of text) {
    fireEvent.keyDown(input, { key: ch });
    set.call(input, input.value + ch);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: ch,
        inputType: "insertText",
      }),
    );
    fireEvent.keyUp(input, { key: ch });
  }
}

test("keys typed into ⌘K one at a time stay in the box and list a note by its title", async () => {
  const rows = {
    notes: [{ id: "n-1", v: 1, at: 1, data: { title: "Heart failure" } }],
  } as Record<string, { id: string; v: number; at: number; data: unknown }[]>;
  const services = {
    docs: { list: async (c: string) => rows[c] ?? [] },
    outbox: {},
  } as unknown as NonNullable<Parameters<typeof Shell>[0]["services"]>;
  render(
    <Shell
      path="/"
      onNavigate={vi.fn()}
      areas={[
        ...areas,
        { id: "library", route: "/library", nav: "Library", view: () => null },
      ]}
      services={services}
    />,
  );
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  await new Promise((r) => setTimeout(r, 20));
  const input = screen.getByPlaceholderText(
    /Type a command/,
  ) as HTMLInputElement;
  typeKeys(input, "hea");
  expect(input.value).toBe("hea");
  const shown = await screen.findAllByRole("option");
  expect(shown[0]!.textContent).toContain("Heart failure");
  typeKeys(input, "r");
  expect(input.value).toBe("hear");
});
