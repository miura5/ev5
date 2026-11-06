import { act, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App.tsx";
import { saveToken } from "../commands/client.ts";

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

test("the bare root replaces itself with /today; Back and Forward keep ?open=", async () => {
  saveToken("t");
  window.history.replaceState(null, "", "/");
  const before = window.history.length;
  const { unmount } = render(<App />);
  await flush();
  expect(window.location.pathname).toBe("/today");
  expect(window.history.length).toBe(before);
  await act(async () => {
    window.history.pushState(null, "", "/library?open=s1");
  });
  expect(window.location.search).toBe("?open=s1");
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(window.location.pathname).toBe("/today");
  await act(async () => {
    window.history.forward();
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(window.location.pathname + window.location.search).toBe(
    "/library?open=s1",
  );
  expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
  unmount();
});
