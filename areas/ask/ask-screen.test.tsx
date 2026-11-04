import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AskScreen, NOT_CONNECTED } from "./Ask.screen.tsx";
import { toAskJob } from "./useAskJobs.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("a job maps to a chat job row", () => {
  expect(toAskJob({ id: "j1", kind: "study-plan", state: "needs-you", summary: "Approve" })).toEqual({
    id: "j1",
    job: { title: "Study plan", meta: "Approve", value: "needs you", running: false },
  });
});

test("with a token, open jobs show; sending says the chat is not connected", async () => {
  localStorage.setItem("ev5.token", "t");
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ jobs: [{ id: "j1", kind: "practice-set", state: "running", summary: "3 of 10" }] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<AskScreen />);
  await waitFor(() => expect(screen.getByText("Practice set")).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/jobs", { headers: { authorization: "Bearer t" } });
  const box = screen.getByLabelText("Message to E.V.");
  fireEvent.change(box, { target: { value: "hi" } });
  fireEvent.keyDown(box, { key: "Enter" });
  expect(screen.getByText("hi")).toBeTruthy();
  expect(screen.getByText(NOT_CONNECTED)).toBeTruthy();
});

test("without a token nothing is fetched", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<AskScreen />);
  expect(fetchMock).not.toHaveBeenCalled();
});
