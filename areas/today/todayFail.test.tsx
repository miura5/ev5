import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { failureSentence } from "../../commands/client.ts";
import { LibraryScreen as RawLibrary } from "../library/Library.screen.tsx";
import { TodayScreen as RawToday } from "./Today.screen.tsx";
import { withToasts } from "../testToasts.tsx";

const TodayScreen = withToasts(RawToday);
const LibraryScreen = withToasts(RawLibrary);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const fail = (status: number) =>
  vi.fn(async () => new Response("{}", { status }));

for (const [name, Screen] of [
  ["Today", TodayScreen],
  ["Library", LibraryScreen],
] as const) {
  test(`${name}: a 401 shows nothing, no empty state and no paste form`, async () => {
    localStorage.setItem("ev5.token", "t");
    const f = fail(401);
    vi.stubGlobal("fetch", f);
    const { container } = render(<Screen />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
    expect(document.querySelector("input")).toBeNull();
  });

  test(`${name}: a 5xx shows the plain sentence through the kit notice`, async () => {
    localStorage.setItem("ev5.token", "t");
    vi.stubGlobal("fetch", fail(503));
    render(<Screen />);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        failureSentence("server"),
      ),
    );
  });
}
