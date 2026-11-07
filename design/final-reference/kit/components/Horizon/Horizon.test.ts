import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Horizon } from "./Horizon";
import { SAMPLE_DAYS, Story } from "./Horizon.story";

afterEach(cleanup);

test("the rail is one short button; the chart keeps the full read-out", () => {
  render(createElement(Horizon, { days: SAMPLE_DAYS.slice(0, 4), onOpen: () => {} }));
  expect(screen.getByRole("button", { name: "Next 14 days. Open Progress" })).toBeTruthy();
  expect(screen.getByRole("img", { name: /Today 4, Tue Nov 3 9, Wed Nov 4 6, Thu Nov 5 2 \(Biology exam 3\)/ })).toBeTruthy();
  expect(screen.getByText("4 cards due today")).toBeTruthy();
});

test("arrow keys read each day out", () => {
  render(createElement(Horizon, { days: SAMPLE_DAYS, onOpen: () => {} }));
  const h = screen.getByRole("button");
  for (let i = 0; i < 4; i++) fireEvent.keyDown(h, { key: "ArrowRight" });
  expect(h.textContent).toContain("Thu 5 · 2 cards due · Exam 3");
  fireEvent.keyDown(h, { key: "Escape" });
  expect(h.textContent).toContain("4 cards due today");
});

test("a cleared plan says so", () => {
  render(createElement(Horizon, { days: [{ label: "Today", due: 0 }], cleared: true }));
  expect(screen.getByText("Done for today")).toBeTruthy();
});

test("today is the one bar in text grey, posts are solid, an empty day is a hairline", () => {
  const { container } = render(createElement(Story));
  expect(container.querySelectorAll(".kit-horizon-bar.today").length).toBe(2);
  expect(container.querySelectorAll(".kit-horizon-zero").length).toBe(2);
  expect(container.querySelectorAll(".kit-horizon-post").length).toBe(4);
  expect(container.querySelectorAll(".kit-horizon-dl").length).toBe(14);
  expect(container.querySelectorAll(".kit-horizon-tick").length).toBe(28);
});

test("dates mode is the rail from Coming up alone: no bars, no counts, a dot per dated day", () => {
  render(createElement(Horizon, { days: SAMPLE_DAYS, show: "dates", onOpen: () => {} }));
  const h = screen.getByRole("button", { name: "Next 14 days, dated items. Open Progress" });
  expect(h.querySelectorAll(".kit-horizon-bar, .kit-horizon-zero, .kit-horizon-post").length).toBe(0);
  expect(h.querySelectorAll(".kit-horizon-dot").length).toBe(2);
  expect(h.querySelectorAll(".kit-horizon-now").length).toBe(1);
  expect(h.textContent).toBe("Exam 3 Thu · Interview Nov 9");
  expect(h.textContent).not.toMatch(/due/);
});

test("dates mode reads each day out with the arrow keys", () => {
  render(createElement(Horizon, { days: SAMPLE_DAYS, show: "dates", onOpen: () => {} }));
  const h = screen.getByRole("button");
  fireEvent.keyDown(h, { key: "ArrowRight" });
  fireEvent.keyDown(h, { key: "ArrowRight" });
  expect(h.textContent).toBe("Tomorrow · nothing dated");
  fireEvent.keyDown(h, { key: "ArrowRight" });
  fireEvent.keyDown(h, { key: "ArrowRight" });
  expect(h.textContent).toBe("Thu 5 · Biology exam 3");
  expect(h.querySelectorAll(".kit-horizon-day.sel").length).toBe(1);
});

test("dates mode with nothing dated says so", () => {
  render(createElement(Horizon, { days: [{ label: "Today" }, { label: "Tue Nov 3" }], show: "dates" }));
  expect(screen.getByText("Nothing dated in 14 days")).toBeTruthy();
});
