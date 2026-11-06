import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StudyCard } from "./StudyCard";
import { Story } from "./StudyCard.story";

afterEach(cleanup);

test("study shows no answer until turned, then rates", () => {
  const onTurn = vi.fn();
  const onRate = vi.fn();
  const props = { kicker: "Term", face: "Demand", onTurn, onRate };
  const { rerender } = render(createElement(StudyCard, props));
  expect(screen.queryByText("Good")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Turn over/ }));
  expect(onTurn).toHaveBeenCalled();
  rerender(
    createElement(StudyCard, {
      ...props,
      answer: "Volume at end of diastole",
      from: "Notes",
    }),
  );
  expect(screen.getByText("Volume at end of diastole")).toBeTruthy();
  expect(screen.getByText("from Note · Notes")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Good/ }));
  expect(onRate).toHaveBeenCalledWith("good");
});

test("an answer with no source is unverified", () => {
  render(createElement(StudyCard, { kicker: "Term", face: "x", answer: "y" }));
  expect(screen.getByText("unverified")).toBeTruthy();
});

test("the hero flips with Space and moves with the arrows", () => {
  const hero = {
    position: 1,
    total: 3,
    onFlip: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
  };
  render(createElement(StudyCard, { kicker: "Term", face: "x", hero }));
  const card = document.querySelector("[data-ui='study-card']")!;
  fireEvent.keyDown(card, { key: " " });
  fireEvent.keyDown(card, { key: "ArrowRight" });
  fireEvent.keyDown(card, { key: "ArrowLeft" });
  expect(hero.onFlip).toHaveBeenCalledTimes(1);
  expect(hero.onNext).toHaveBeenCalledTimes(1);
  expect(hero.onPrev).toHaveBeenCalledTimes(1);
  expect(screen.getByText("1 / 3")).toBeTruthy();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Supply and demand")).toBeTruthy();
});
