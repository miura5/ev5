import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AskScreen } from "./Ask.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

test("a reload brings the saved chat back, a send names its chat, and Just tell me is the command", async () => {
  localStorage.setItem("ev5.token", "t");
  const lines = [
    {
      id: "talk_1",
      role: "user",
      text: "old question",
      at: "2026-11-05T15:00:00Z",
    },
    {
      id: "talk_2",
      role: "ev",
      text: "old answer",
      at: "2026-11-05T15:00:05Z",
    },
  ];
  let sentOne = false;
  const f = vi.fn(async (url: string, _init?: { body?: string }) => {
    if (url.startsWith("/api/v1/ask/chat"))
      return ok({
        chatId: "chat_a",
        lines: sentOne
          ? [
              ...lines,
              { id: "talk_3", role: "user", text: "next", at: "x" },
              { id: "talk_4", role: "ev", text: "Try it first.", at: "x" },
            ]
          : lines,
      });
    if (url === "/api/v1/ask" && (sentOne = true))
      return ok({
        reply: {
          text: "Try it first.",
          unverified: false,
          asksTry: true,
          chatId: "chat_a",
        },
      });
    if (url.startsWith("/api/v1/commands/"))
      return ok({ mode: "direct", result: {} });
    return ok({ jobs: [] });
  });
  vi.stubGlobal("fetch", f);
  render(<AskScreen />);
  await waitFor(() => expect(screen.getByText("old answer")).toBeTruthy());
  const box = screen.getByLabelText("Message to E.V.");
  fireEvent.change(box, { target: { value: "next" } });
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(screen.getByText("Try it first.")).toBeTruthy());
  const send = f.mock.calls.find(([u]) => u === "/api/v1/ask");
  expect(JSON.parse((send?.[1] as { body: string }).body)).toEqual({
    text: "next",
    chat_id: "chat_a",
  });
  fireEvent.click(screen.getByText("Just tell me"));
  await waitFor(() =>
    expect(
      f.mock.calls.some(([u]) => u === "/api/v1/commands/ask.just_tell_me"),
    ).toBe(true),
  );
  const cmd = f.mock.calls.find(
    ([u]) => u === "/api/v1/commands/ask.just_tell_me",
  );
  expect(JSON.parse((cmd?.[1] as { body: string }).body).input).toEqual({
    id: "talk_4",
  });
});
