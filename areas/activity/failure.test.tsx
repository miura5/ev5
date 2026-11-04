import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ActivityScreen } from "./Activity.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const answer = (status: number) => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));
};

test("a refused token shows nothing: no data, no empty state", async () => {
  answer(401);
  const { container } = render(<ActivityScreen />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 20));
  expect(container.textContent).toBe("");
  expect(screen.queryByRole("status")).toBeNull();
});

test("a server error shows the plain sentence", async () => {
  answer(503);
  render(<ActivityScreen />);
  expect((await screen.findByRole("status")).textContent).toBe(
    "Something went wrong on E.V.'s side. Try again in a moment.",
  );
});

test("while the list loads no group says None; it does once the list arrives empty", async () => {
  localStorage.setItem("ev5.token", "t");
  let release!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>((res) => (release = res))),
  );
  render(<ActivityScreen />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(screen.queryByText("None.")).toBeNull();
  expect(screen.getAllByText("Loading…")).toHaveLength(3);
  release(
    new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  expect(await screen.findAllByText("None.")).toHaveLength(3);
  expect(screen.queryByText("Loading…")).toBeNull();
});
