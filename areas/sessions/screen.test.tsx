import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { sessionRowsBody } from "./sessionRows.testkit.ts";
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
    topic: "Energy budget",
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
    createdAt: "2026-11-04T15:00:00.000Z",
    title: "Heart",
    blocks: [
      { type: "p", runs: [{ text: "Intro" }] },
      { type: "todo", checked: false, runs: [{ text: "Draw the curve" }] },
    ],
  },
};

const ok = (b: unknown = {}) => ({
  ok: true,
  status: 200,
  json: async () => b,
});
/** A command post: the command's name and its input, else undefined. */
const posted = (url: string, init?: RequestInit) =>
  init?.method === "POST" && url.includes("commands/")
    ? {
        name: url.slice(url.indexOf("commands/") + 9),
        input: (
          JSON.parse(String(init.body)) as { input: Record<string, unknown> }
        ).input,
      }
    : undefined;

function stub() {
  const puts: { name: string; input: Record<string, unknown> }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const c = posted(url, init);
    if (c) {
      puts.push(c);
      return ok({ mode: "direct", result: {} });
    }
    const json = url.includes("collection=notes")
      ? note
      : sessionRowsBody(url, [session]);
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
  expect(puts[0]).toEqual({ name: "session.pause", input: { id: "s1" } });
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
      if (posted(url, init)) {
        stored = {
          ...stored,
          events: { "page-1": { type: "break", at: new Date().toISOString() } },
        };
        return ok({ mode: "direct", result: {} });
      }
      const json = url.includes("collection=notes")
        ? note
        : sessionRowsBody(url, [{ ...session, data: stored }]);
      return { ok: true, status: 200, json: async () => json };
    }),
  );
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    render(<SessionsScreen />);
    await screen.findByText("Heart");
    const timer = () =>
      document.querySelector('[data-ui="session-timer"]')?.textContent;
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
  expect(puts[0]?.name).toBe("note.save");
  expect(puts[0]?.input.if_version).toBe(5);
  const blocks = JSON.parse(String(puts[0]?.input.body)) as {
    checked?: boolean;
  }[];
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
  const puts: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const c = posted(url, init);
      if (c) {
        puts.push(c.name);
        v += 1;
        const at = new Date().toISOString();
        if (c.name === "session.pause")
          stored = {
            ...stored,
            events: {
              ...(stored.events as object),
              [`page-${at.slice(0, 19).replace(/[-:T]/g, (c) => (c === "T" ? "-" : ""))}-x${v}`]:
                { type: "break", at },
            },
          };
        if (c.name === "session.end")
          stored = { ...stored, status: "ended", endedAt: at, minutes: 10 };
        return ok({ mode: "direct", result: {} });
      }
      const json = url.includes("collection=notes")
        ? note
        : sessionRowsBody(url, [{ ...session, v, data: stored }]);
      return ok(json);
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
  const held = document.querySelector('[data-ui="session-timer"]')?.textContent;
  await new Promise((r) => setTimeout(r, 1100));
  expect(document.querySelector('[data-ui="session-timer"]')?.textContent).toBe(
    held,
  );
  fireEvent.click(screen.getByText("End"));
  await waitFor(() => expect(puts).toEqual(["session.pause", "session.end"]));
  await screen.findByText("Saved to Progress.");
});

test("with no active session there is no session bar, Pause or End", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ rows: [] }),
    })),
  );
  render(<SessionsScreen />);
  await screen.findByText("No session yet.");
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
  await waitFor(() => expect(puts).toEqual(["session.pause", "session.end"]));
});
