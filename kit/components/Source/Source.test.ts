import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Source } from "./Source";
import { Story } from "./Source.story";

afterEach(cleanup);

test("a source names its note, opens it when it can, and says unverified without one", () => {
  const onOpen = vi.fn();
  const { rerender } = render(
    createElement(Source, { from: "Heparin", onOpen }),
  );
  fireEvent.click(screen.getByRole("button", { name: "from Note · Heparin" }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  rerender(createElement(Source, { from: "Heparin" }));
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("from Note · Heparin")).toBeTruthy();
  rerender(createElement(Source));
  expect(screen.getByText("unverified")).toBeTruthy();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByText(/from Note|unverified/).length).toBe(3);
});
