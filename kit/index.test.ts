import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  Dot,
  Meter,
  Segmented,
  STORIES,
  Tabs,
  type DotTone,
  type MeterPart,
  type TabItem,
} from "./index.ts";

afterEach(cleanup);

test("the gallery lists the status and choice components", () => {
  const names = STORIES.map((s) => s.name);
  for (const n of ["Dot", "Meter", "Tabs", "Field"]) expect(names).toContain(n);
});

test("the status and choice components come out of the kit's one door", () => {
  const tone: DotTone = "warn";
  const parts: MeterPart[] = [{ tone: "ok", count: 2 }];
  const tabs: TabItem[] = [{ id: "a", label: "Sets", count: 1 }];
  render(
    createElement(
      "div",
      null,
      createElement(Dot, { tone, label: "Waiting" }),
      createElement(Meter, { label: "Two learned", parts }),
      createElement(Tabs, {
        label: "Views",
        tabs,
        value: "a",
        onChange: vi.fn(),
      }),
      createElement(Segmented, {
        label: "How many",
        options: ["3", "5"],
        value: "3",
        onChange: vi.fn(),
      }),
    ),
  );
  expect(screen.getByRole("img", { name: "Waiting" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Two learned" })).toBeTruthy();
  expect(screen.getByRole("radiogroup", { name: "Views" })).toBeTruthy();
  expect(screen.getByRole("radiogroup", { name: "How many" })).toBeTruthy();
});
