import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App.tsx";

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

test("other paths keep the hello area", () => {
  render(<App path="/" />);
  expect(screen.getByText("Hello, E.V.")).toBeTruthy();
});
