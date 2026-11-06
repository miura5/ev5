import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AskScreen } from "./Ask.screen.tsx";
import { toAskJob } from "./useAskJobs.ts";
import { failureSentence } from "../../commands/client.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("a job maps to a chat job row", () => {
  expect(
    toAskJob({
      id: "j1",
      kind: "prep-plan",
      state: "needs-you",
      summary: "Approve",
    }),
  ).toEqual({
    id: "j1",
    job: {
      title: "Prep plan",
      meta: "Approve",
      value: "needs you",
      running: false,
    },
  });
});

test("with a token, open jobs show and a sent question gets the server's cited reply", async () => {
  localStorage.setItem("ev5.token", "t");
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith("/ask")
        ? {
            reply: {
              text: "Under 60.",
              source: "Heart rate",
              unverified: false,
              asksTry: false,
            },
          }
        : {
            jobs: [
              {
                id: "j1",
                kind: "practice-set",
                state: "running",
                summary: "3 of 10",
              },
            ],
          },
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AskScreen />);
  await waitFor(() => expect(screen.getByText("Practice set")).toBeTruthy());
  const box = screen.getByLabelText("Message to E.V.");
  fireEvent.change(box, { target: { value: "hi" } });
  fireEvent.keyDown(box, { key: "Enter" });
  expect(screen.getByText("hi")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("Under 60.")).toBeTruthy());
  expect(fetchMock.mock.calls.some(([u]) => u === "/api/v1/ask")).toBe(true);
});

test("an unverified reply says so, and a refused one reads as a plain sentence", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        reply: { text: "Maybe.", unverified: true, asksTry: false },
      }),
    })),
  );
  localStorage.setItem("ev5.token", "t");
  render(<AskScreen />);
  const box = screen.getByLabelText("Message to E.V.");
  fireEvent.change(box, { target: { value: "q" } });
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() =>
    expect(screen.getByText("Unverified: Maybe.")).toBeTruthy(),
  );
});

async function sendWith(res: unknown) {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) =>
      u.endsWith("/ask") ? res : { ok: true, json: async () => ({ jobs: [] }) },
    ),
  );
  render(<AskScreen />);
  const box = screen.getByLabelText("Message to E.V.");
  fireEvent.change(box, { target: { value: "q" } });
  fireEvent.keyDown(box, { key: "Enter" });
}

test("a 401 reply shows the plain sentence, never the server's text, and the turn ends", async () => {
  await sendWith({
    ok: false,
    status: 401,
    json: async () => ({ error: "bad bearer xyz" }),
  });
  await waitFor(() =>
    expect(screen.getByText(failureSentence("refused"))).toBeTruthy(),
  );
  expect(screen.queryByText(/bad bearer/)).toBeNull();
});

test("a 5xx reply shows the plain sentence, never the server's text", async () => {
  await sendWith({
    ok: false,
    status: 503,
    json: async () => ({ error: "upstream boom" }),
  });
  await waitFor(() =>
    expect(screen.getByText(failureSentence("server"))).toBeTruthy(),
  );
  expect(screen.queryByText(/upstream boom/)).toBeNull();
});

test("without a token nothing is fetched", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<AskScreen />);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("?text= prefills the input and sends nothing", () => {
  const fetchMock = vi.fn(async (_u: string) => ({
    ok: true,
    json: async () => ({ jobs: [] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  window.history.pushState({}, "", "/ask?text=what%20is%20a%20ratio");
  render(<AskScreen />);
  const box = screen.getByLabelText("Message to E.V.") as HTMLTextAreaElement;
  expect(box.value).toBe("what is a ratio");
  expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/ask"))).toBe(
    false,
  );
  window.history.pushState({}, "", "/");
});
