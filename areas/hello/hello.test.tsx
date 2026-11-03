import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { helloArea } from "./area.ts";
import { HelloView } from "./Hello.view.tsx";

test("hello area renders", () => {
  render(<HelloView />);
  expect(screen.getByText("Hello, E.V.")).toBeTruthy();
  expect(helloArea.route).toBe("/");
});
