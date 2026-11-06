import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Source } from "./Source";
import { Story } from "./Source.story";

afterEach(cleanup);

test("a source names its note, opens it when it can, and says unverified without one", () => {
  const onOpen = vi.fn();
  const { rerender } = render(
    createElement(Source, { from: "Photosynthesis", onOpen }),
  );
  fireEvent.click(screen.getByRole("button", { name: "from Note · Photosynthesis" }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  rerender(createElement(Source, { from: "Photosynthesis" }));
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("from Note · Photosynthesis")).toBeTruthy();
  rerender(createElement(Source));
  expect(screen.getByText("unverified")).toBeTruthy();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByText(/from Note|unverified/).length).toBe(3);
});
