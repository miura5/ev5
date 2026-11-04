import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SessionsScreen } from "./Sessions.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const session = {
  id: "s1",
  v: 3,
  data: {
    schema: 2,
    writer: "page",
    at: "2026-11-04T15:00:00.000Z",
    source: "E.V. Home",
    date: "2026-11-04",
    topic: "Cardiac output",
    noteId: "n1",
    status: "active",
    startedAt: new Date(Date.now() - 60_000).toISOString(),
  },
};
const note = {
  v: 5,
  data: {
    schema: 1,
    writer: "page",
    at: "2026-11-04T15:00:00.000Z",
    source: "E.V. Home",
    createdAt: "2026-11-04T15:00:00.000Z",
    title: "Heart",
    blocks: [
      { type: "p", runs: [{ text: "Intro" }] },
      { type: "todo", checked: false, runs: [{ text: "Draw the curve" }] },
    ],
  },
};

function stub() {
  const puts: { url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, status: 200, json: async () => ({}) };
    }
    const json = url.includes("collection=notes") ? note : { docs: [session] };
    return { ok: true, status: 200, json: async () => json };
  });
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("ev5.token", "t");
  return puts;
}

test("Space pauses and resumes, but not while typing; Esc leaves a field", async () => {
  const puts = stub();
  render(<SessionsScreen />);
  await waitFor(() => expect(screen.getByText("Cardiac output")).toBeTruthy());
  fireEvent.keyDown(document.body, { key: " " });
  await waitFor(() => expect(puts).toHaveLength(1));
  const ev = Object.values(
    (puts[0]?.body as { events: Record<string, { type: string }> }).events,
  );
  expect(ev.map((e) => e.type)).toEqual(["break"]);
  const field = document.createElement("textarea");
  document.body.append(field);
  field.focus();
  fireEvent.keyDown(field, { key: " " });
  expect(puts).toHaveLength(1);
  fireEvent.keyDown(field, { key: "Escape" });
  expect(document.activeElement).not.toBe(field);
  field.remove();
});

test("a todo block in the note is a real check that saves the note", async () => {
  const puts = stub();
  render(<SessionsScreen />);
  const box = await screen.findByLabelText("Draw the curve");
  fireEvent.click(box);
  await waitFor(() => expect(puts).toHaveLength(1));
  expect(puts[0]?.url).toContain("collection=notes");
  expect(puts[0]?.url).toContain("if_version=5");
  const blocks = (puts[0]?.body as { blocks: { checked?: boolean }[] }).blocks;
  expect(blocks[1]?.checked).toBe(true);
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Draw the curve") as HTMLInputElement).checked,
    ).toBe(true),
  );
});
