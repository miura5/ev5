import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App.tsx";
import { forgetToken, saveToken } from "../commands/client.ts";

test("/kit renders the tokens gallery and the theme toggle flips data-theme", () => {
  render(<App path="/kit" />);
  for (const name of [
    "Colour",
    "Text",
    "Space",
    "Radius",
    "Duration",
    "Components",
  ]) {
    expect(screen.getByRole("region", { name })).toBeTruthy();
  }
  const root = document.querySelector("[data-ui='kit-gallery']");
  expect(root?.getAttribute("data-theme")).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: /switch to light/ }));
  expect(root?.getAttribute("data-theme")).toBe("light");
});

test("with no token the app shows the token screen, not the shell", () => {
  forgetToken();
  render(<App path="/today" />);
  expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
  expect(document.querySelector("[data-ui='token-screen']")).toBeTruthy();
});

test("other paths open the shell on Today once a token is saved", async () => {
  saveToken("t");
  const { unmount } = render(<App path="/" />);
  expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
  await act(async () => {
    await Promise.resolve();
  });
  unmount();
});
