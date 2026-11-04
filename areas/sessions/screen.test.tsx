import {
  act,
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
  await waitFor(() => expect(screen.getByText("Heart")).toBeTruthy());
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

test("the timer counts up each second while running and holds while paused", async () => {
  stub();
  session.data.startedAt = new Date().toISOString();
  // the server keeps what is written, so the pause comes back on the re-read
  let stored: Record<string, unknown> = session.data;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        stored = JSON.parse(String(init.body)) as Record<string, unknown>;
        return { ok: true, status: 200, json: async () => ({}) };
      }
      const json = url.includes("collection=notes")
        ? note
        : { docs: [{ ...session, data: stored }] };
      return { ok: true, status: 200, json: async () => json };
    }),
  );
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    render(<SessionsScreen />);
    await screen.findByText("Heart");
    const timer = () =>
      document.querySelector('[data-ui="timer"]')?.textContent;
    expect(timer()).toBe("0:00");
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(timer()).toBe("0:01");
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(timer()).toBe("0:02");
    fireEvent.keyDown(document.body, { key: " " });
    await act(() => vi.advanceTimersByTimeAsync(100));
    const held = timer();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(timer()).toBe(held);
  } finally {
    vi.useRealTimers();
    session.data.startedAt = new Date(Date.now() - 60_000).toISOString();
  }
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

function stateful(startedAt: string) {
  let stored: Record<string, unknown> = { ...session.data, startedAt };
  let v = 3;
  const puts: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        stored = JSON.parse(String(init.body)) as Record<string, unknown>;
        puts.push(stored);
        v += 1;
        return { ok: true, status: 200, json: async () => ({}) };
      }
      const json = url.includes("collection=notes")
        ? note
        : { docs: [{ ...session, v, data: stored }] };
      return { ok: true, status: 200, json: async () => json };
    }),
  );
  localStorage.setItem("ev5.token", "t");
  return puts;
}

test("End on a paused session ends it, and the pause survives a reload", async () => {
  const puts = stateful(new Date(Date.now() - 600_000).toISOString());
  render(<SessionsScreen />);
  await screen.findByText("Heart");
  fireEvent.click(screen.getByText("Pause"));
  await screen.findByText("Resume");
  // a reload: a new screen reads the stored document and still shows it paused
  cleanup();
  render(<SessionsScreen />);
  await screen.findByText("Resume");
  const held = document.querySelector('[data-ui="timer"]')?.textContent;
  await new Promise((r) => setTimeout(r, 1100));
  expect(document.querySelector('[data-ui="timer"]')?.textContent).toBe(held);
  fireEvent.click(screen.getByText("End"));
  await waitFor(() => expect(puts).toHaveLength(2));
  const last = puts[1] as { status: string; endedAt: string; minutes: number };
  expect(last.status).toBe("ended");
  expect(typeof last.endedAt).toBe("string");
  expect(last.minutes).toBeGreaterThanOrEqual(0);
  await screen.findByText("Saved to Progress.");
});

test("with no active session there is no session bar, Pause or End", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ docs: [] }),
    })),
  );
  render(<SessionsScreen />);
  await screen.findByText("no session yet");
  expect(screen.queryByText("Pause")).toBeNull();
  expect(screen.queryByText("End")).toBeNull();
  expect(document.querySelector('[data-ui="session-bar"]')).toBeNull();
});

test("End pressed right after Pause (before the re-read) still ends the session", async () => {
  const puts = stateful(new Date(Date.now() - 600_000).toISOString());
  render(<SessionsScreen />);
  await screen.findByText("Heart");
  fireEvent.keyDown(document.body, { key: " " });
  fireEvent.click(screen.getByText("End"));
  await waitFor(() => expect(puts.length).toBeGreaterThanOrEqual(2));
  const last = puts[puts.length - 1] as {
    status: string;
    events: Record<string, { type: string }>;
  };
  expect(last.status).toBe("ended");
  expect(
    Object.values(last.events)
      .map((e) => e.type)
      .sort(),
  ).toEqual(["break", "end"]);
});
