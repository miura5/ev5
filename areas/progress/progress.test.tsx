import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { progressArea } from "./area.ts";

test("Progress is an area with a screen", () => {
  const View = progressArea.view;
  render(<View />);
  expect(progressArea.nav).toBe("Progress");
  expect(screen.getByRole("heading", { name: "Progress" })).toBeTruthy();
  expect(screen.getByText("last 8 weeks")).toBeTruthy();
});
