import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Tile } from "./Tile";
import { Story } from "./Tile.story";

afterEach(cleanup);

test("a tile shows title, meta and value and opens on tap", () => {
  const onOpen = vi.fn();
  render(
    createElement(Tile, {
      title: "Heparin",
      meta: "12 cards",
      value: "3 due",
      onOpen,
    }),
  );
  expect(screen.getByText("12 cards")).toBeTruthy();
  expect(screen.getByText("3 due")).toBeTruthy();
  fireEvent.click(screen.getByRole("button"));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByRole("button").length).toBe(2);
});
